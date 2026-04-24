import os
from google import genai
from dotenv import load_dotenv

load_dotenv()
key = os.getenv("GOOGLE_MAPS_API_KEY")
client = genai.Client(api_key=key)

for m in client.models.list():
    print(m.name)
