import sys
import types


def ensure_test_stubs():
    if "vertexai" not in sys.modules:
        vertexai = types.ModuleType("vertexai")

        def init(*args, **kwargs):
            return None

        vertexai.init = init
        generative_models = types.ModuleType("vertexai.generative_models")

        class GenerativeModel:
            def __init__(self, *args, **kwargs):
                pass

        generative_models.GenerativeModel = GenerativeModel
        generative_models.Tool = object
        generative_models.grounding = types.SimpleNamespace()
        vertexai.generative_models = generative_models
        sys.modules["vertexai"] = vertexai
        sys.modules["vertexai.generative_models"] = generative_models

    if "googlemaps" not in sys.modules:
        googlemaps = types.ModuleType("googlemaps")

        class Client:
            def __init__(self, *args, **kwargs):
                pass

        googlemaps.Client = Client
        sys.modules["googlemaps"] = googlemaps

    if "slowapi" not in sys.modules:
        slowapi = types.ModuleType("slowapi")

        class Limiter:
            def __init__(self, *args, **kwargs):
                pass

            def limit(self, *args, **kwargs):
                def decorator(func):
                    return func

                return decorator

        def _rate_limit_exceeded_handler(*args, **kwargs):
            return None

        slowapi.Limiter = Limiter
        slowapi._rate_limit_exceeded_handler = _rate_limit_exceeded_handler
        sys.modules["slowapi"] = slowapi

        util = types.ModuleType("slowapi.util")
        util.get_remote_address = lambda request=None: "127.0.0.1"
        sys.modules["slowapi.util"] = util

        errors = types.ModuleType("slowapi.errors")

        class RateLimitExceeded(Exception):
            pass

        errors.RateLimitExceeded = RateLimitExceeded
        sys.modules["slowapi.errors"] = errors

    if "dotenv" not in sys.modules:
        dotenv = types.ModuleType("dotenv")
        dotenv.load_dotenv = lambda *args, **kwargs: None
        sys.modules["dotenv"] = dotenv
