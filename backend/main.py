import os
import uuid
import logging
import time
from typing import Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field
from starlette.middleware.base import BaseHTTPMiddleware

import vertexai
from vertexai.generative_models import GenerativeModel, Tool, grounding
import googlemaps

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from dotenv import load_dotenv
from orchestrator import get_orchestrator

load_dotenv()

def _env_flag(name: str, default: str = "false") -> bool:
    value = os.getenv(name, default).strip().lower()
    return value in {"1", "true", "yes", "on"}


# ── Logging Setup (local by default; cloud optional) ──
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ENABLE_CLOUD_LOGGING = _env_flag("ENABLE_CLOUD_LOGGING", "false")

if ENABLE_CLOUD_LOGGING:
    try:
        from google.cloud import logging as cloud_logging

        google_cloud_logging_client = cloud_logging.Client()
        google_cloud_logging_client.setup_logging()
        logger.info("✅ Google Cloud Logging initialized")
    except Exception as e:
        logger.warning(f"⚠️  Cloud Logging unavailable, using standard logging: {e}")
else:
    logger.info("ℹ️ Cloud Logging disabled (using local standard logging)")

# ── Rate Limiter ──
limiter = Limiter(key_func=get_remote_address)

app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS — restrict to your actual frontend origin ──
_raw_allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")
ALLOWED_ORIGINS = [o.strip() for o in _raw_allowed_origins.split(",") if o.strip()]
ALLOW_CREDENTIALS = "*" not in ALLOWED_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=ALLOW_CREDENTIALS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

# ── Request Size Limit Middleware (10 KB) ──
MAX_REQUEST_BODY_BYTES = 10 * 1024  # 10 KB

class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method in ("POST", "PUT", "PATCH"):
            content_length = request.headers.get("content-length")
            if content_length:
                # Guard against malformed content-length headers to avoid 500s.
                try:
                    if int(content_length) > MAX_REQUEST_BODY_BYTES:
                        return JSONResponse(
                            status_code=413,
                            content={"detail": "Request body too large. Maximum size is 10 KB."},
                        )
                except ValueError:
                    return JSONResponse(
                        status_code=400,
                        content={"detail": "Invalid content-length header."},
                    )
        return await call_next(request)

app.add_middleware(RequestSizeLimitMiddleware)

GOOGLE_CLOUD_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT")
GOOGLE_CLOUD_REGION = os.getenv("GOOGLE_CLOUD_REGION", "us-central1")
GEMINI_MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")  # ✅ fixed
MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

vertex_initialized = False
try:
    if GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_PROJECT != "<ask me for this>":
        vertexai.init(project=GOOGLE_CLOUD_PROJECT, location=GOOGLE_CLOUD_REGION)
        vertex_initialized = True
        logger.info(f"✅ Vertex AI initialized: project={GOOGLE_CLOUD_PROJECT}, region={GOOGLE_CLOUD_REGION}")
except Exception as e:
    logger.warning(f"Failed to initialize Vertex AI: {e}", exc_info=True)

# Google Maps client
gmaps = None
try:
    if MAPS_API_KEY and MAPS_API_KEY.startswith("AIzaSy"):
        gmaps = googlemaps.Client(key=MAPS_API_KEY)
        logger.info("✅ Google Maps client initialized")
    else:
        logger.warning("No valid GOOGLE_MAPS_API_KEY found (needs AIzaSy... key). Booth finder disabled.")
except Exception as e:
    logger.error(f"Failed to initialize Google Maps: {e}", exc_info=True)

# ── Request Models with Input Validation ──
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    session_id: str = Field(default="", max_length=200)

class BoothRequest(BaseModel):
    address: str = Field(..., min_length=1, max_length=500)
    session_id: str = Field(default="", max_length=200)


SYSTEM_INSTRUCTION = (
    "You are a helpful, accurate, and politically neutral Indian Election Assistant. "
    "The current date is April 2026. Respond in the same language the user writes in. "
    "Provide clear, concise answers with the LATEST and most RECENT information available. "
    "ALWAYS format your answers using Markdown (use **bold** for emphasis, lists, etc). "
    "If your tool provides URLs/links, you MUST include a 'Resources' section at the bottom "
    "citing the specific URLs."
)

_extractor_model: Optional[GenerativeModel] = None
_grounded_model: Optional[GenerativeModel] = None
_fallback_model: Optional[GenerativeModel] = None


def _get_extractor_model() -> GenerativeModel:
    global _extractor_model
    if _extractor_model is None:
        _extractor_model = GenerativeModel(GEMINI_MODEL_NAME)
    return _extractor_model


def _get_grounded_model() -> GenerativeModel:
    global _grounded_model
    if _grounded_model is None:
        # Vertex no longer accepts google_search_retrieval for recent Gemini calls.
        # Prefer the newer google_search tool shape when available.
        if hasattr(grounding, "GoogleSearch"):
            tool = Tool(google_search=grounding.GoogleSearch())
        elif hasattr(Tool, "from_google_search"):
            tool = Tool.from_google_search()
        else:
            tool = Tool.from_google_search_retrieval(grounding.GoogleSearchRetrieval())
        _grounded_model = GenerativeModel(
            GEMINI_MODEL_NAME,
            system_instruction=[SYSTEM_INSTRUCTION],
            tools=[tool],
        )
    return _grounded_model


def _get_fallback_model() -> GenerativeModel:
    global _fallback_model
    if _fallback_model is None:
        _fallback_model = GenerativeModel(
            GEMINI_MODEL_NAME,
            system_instruction=[SYSTEM_INSTRUCTION],
        )
    return _fallback_model


def _extract_address_from_query(message: str) -> str:
    try:
        extractor = _get_extractor_model()
        resp = extractor.generate_content(
            f"Extract ONLY the physical address, locality, or city from this query. "
            f"If none mentioned, reply with EXACTLY 'None': {message}"
        )
        return (resp.text or "").strip()
    except Exception as exc:
        logger.warning(f"Address extraction failed: {exc}")
        return ""


def _find_polling_stations(address: str, max_results: int = 3) -> dict:
    geocode_result = gmaps.geocode(address)
    if not geocode_result:
        return {
            "reply": f"I couldn't find the location for '{address}'. Please provide a more specific address.",
            "booths": [],
            "location": None,
            "formatted_address": address,
        }

    location = geocode_result[0]["geometry"]["location"]
    formatted_address = geocode_result[0].get("formatted_address", address)
    places_result = gmaps.places_nearby(
        location=location,
        radius=3000,
        keyword="school OR college OR community hall OR polling station OR government building",
    )

    if not places_result.get("results"):
        return {
            "reply": f"I couldn't find any polling stations near `{formatted_address}`. Please check the official ECI portal.",
            "booths": [],
            "location": location,
            "formatted_address": formatted_address,
        }

    booths = []
    for place in places_result["results"][:max_results]:
        booths.append(
            {
                "name": place.get("name"),
                "address": place.get("vicinity"),
                "lat": place["geometry"]["location"]["lat"],
                "lng": place["geometry"]["location"]["lng"],
            }
        )

    reply_parts = [f"📍 **Polling stations near** `{formatted_address}`:\n"]
    for i, b in enumerate(booths, 1):
        maps_link = f"https://www.google.com/maps/search/?api=1&query={b['lat']},{b['lng']}"
        reply_parts.append(f"{i}. **{b['name']}** — {b['address']}  ")
        reply_parts.append(f"   [Open in Google Maps]({maps_link})\n")
    reply_parts.append(
        "\n> ⚠️ *These are likely venues, not confirmed booths. Verify your exact booth on the "
        "[ECI Voter Helpline App](https://voters.eci.gov.in/) using your EPIC number.*"
    )

    return {
        "reply": "\n".join(reply_parts),
        "booths": booths,
        "location": location,
        "formatted_address": formatted_address,
    }


@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "vertex_initialized": vertex_initialized,
        "maps_initialized": gmaps is not None,
        "project": GOOGLE_CLOUD_PROJECT,
        "region": GOOGLE_CLOUD_REGION,
    }

@app.post("/api/chat")
@limiter.limit("20/minute")
async def chat_endpoint(request: Request, req: ChatRequest):
    if not vertex_initialized:
        return {"reply": "Backend is running, but Vertex AI is not initialized. Please ensure GOOGLE_CLOUD_PROJECT and GOOGLE_APPLICATION_CREDENTIALS are set correctly."}

    # ── Orchestrator: classify, extract entities, build context ──
    # Avoid shared conversation state when client does not provide a session id.
    session_id = req.session_id or str(uuid.uuid4())
    orch = get_orchestrator(GEMINI_MODEL_NAME)
    decision = orch.process(session_id, req.message)

    # Quick replies (greetings, out-of-scope) — skip Gemini entirely
    if decision["quick_reply"]:
        return {
            "reply": decision["quick_reply"],
            "intent": decision["intent"],
            "topic": decision["topic"],
        }
    # Location queries → use Google Maps booth finder
    if decision["intent"] == "location" and gmaps:
        address = decision["entities"].get("address", "")
        if not address:
            # Ask Gemini to extract the address from the query
            address = _extract_address_from_query(req.message)

        if address and address.lower() != "none":
            try:
                station_result = _find_polling_stations(address)
                if station_result["booths"]:
                    orch.store_response(session_id, station_result["reply"])
                    logger.info(
                        f"Booth finder: found {len(station_result['booths'])} venues for {station_result['formatted_address']}",
                        extra={"session_id": session_id},
                    )
                    return {
                        "reply": station_result["reply"],
                        "intent": "location",
                        "topic": "booth finder",
                    }
            except Exception as e:
                logger.error(f"Maps lookup failed, falling back to Gemini: {e}", exc_info=True)
        else:
            reply = "I need your location to find the nearest polling booth. Could you please provide your address or locality? For example: *Find my booth near Connaught Place, New Delhi*"
            orch.store_response(session_id, reply)
            return {"reply": reply, "intent": "location", "topic": "booth finder"}

    enriched_prompt = decision["prompt"]
    route = decision["route"]
    
    try:
        model = _get_grounded_model()
        start_time = time.time()
        response = model.generate_content(enriched_prompt)
        elapsed_ms = (time.time() - start_time) * 1000

        # Store response in memory
        orch.store_response(session_id, response.text)
        
        logger.info(f"Chat response generated (with grounding) in {elapsed_ms:.1f}ms", 
                   extra={"session_id": session_id, "intent": decision["intent"], "latency_ms": elapsed_ms})

        return {
            "reply": response.text,
            "intent": decision["intent"],
            "topic": decision["topic"],
        }
                
    except Exception as e:
        logger.warning(f"Grounding-based response failed, retrying without grounding: {e}")
        try:
            model = _get_fallback_model()
            start_time = time.time()
            response = model.generate_content(enriched_prompt)
            elapsed_ms = (time.time() - start_time) * 1000
            orch.store_response(session_id, response.text)
            
            logger.info(f"Chat response generated (fallback) in {elapsed_ms:.1f}ms", 
                       extra={"session_id": session_id, "intent": decision["intent"], "latency_ms": elapsed_ms})
            
            return {"reply": response.text, "intent": decision["intent"], "topic": decision["topic"]}
        except Exception as fallback_error:
            logger.error(f"Chat response generation failed (both attempts): {fallback_error}", exc_info=True)
            raise HTTPException(status_code=500, detail="Unable to generate a response right now.")

# ── Booth Finder via Google Maps ──
@app.post("/api/booth")
@limiter.limit("10/minute")
async def booth_endpoint(request: Request, req: BoothRequest):
    """Find nearest polling booth using Google Maps Geocoding + Places API."""
    if not gmaps:
        return {"reply": "Google Maps is not configured. Please add a valid GOOGLE_MAPS_API_KEY to .env."}
    
    address = req.address.strip()
    if not address:
        return {"reply": "Please provide your address or locality to find the nearest polling booth."}
    
    try:
        station_result = _find_polling_stations(address)
        if not station_result["booths"]:
            return {"reply": station_result["reply"]}

        return {
            "reply": station_result["reply"],
            "booths": station_result["booths"],
            "location": station_result["location"],
        }
    
    except Exception as e:
        logger.error(f"Booth finder error: {e}", exc_info=True, extra={"address": address, "session_id": req.session_id})
        return {"reply": "I'm unable to access location services right now. Please check the [ECI website](https://voters.eci.gov.in/) to find your booth."}

# ── Serve React frontend in production ──
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")
    
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve React SPA — all non-API routes fall back to index.html"""
        file_path = os.path.join(STATIC_DIR, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=True)