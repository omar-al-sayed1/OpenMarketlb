"""
Shared configuration: database, environment variables, constants, logger.
All modules import db, logger, and constants from here.
"""
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi.security import HTTPBearer
import os
import logging
import secrets
import stripe

ROOT_DIR = Path(__file__).parent
UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)
load_dotenv(ROOT_DIR / '.env')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Environment — secure by default. Set ENVIRONMENT=development locally to enable dev conveniences.
ENVIRONMENT = os.environ.get('ENVIRONMENT', 'production').strip().lower()
IS_PRODUCTION = ENVIRONMENT in ('production', 'prod')

# Database
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Auth
# NEVER fall back to a publicly-known secret: in production a missing JWT_SECRET is a fatal
# misconfiguration (would let anyone forge admin tokens). In development we generate a random
# ephemeral secret so local runs work — tokens simply won't survive a restart.
JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET:
    if IS_PRODUCTION:
        raise RuntimeError(
            "JWT_SECRET is not set. Refusing to start in production with an insecure secret. "
            "Generate one (e.g. `openssl rand -hex 64`) and set the JWT_SECRET environment variable."
        )
    JWT_SECRET = secrets.token_urlsafe(64)
    logger.warning(
        "JWT_SECRET not set — using a random ephemeral secret for development. "
        "Existing tokens are invalidated on every restart. Set JWT_SECRET to persist sessions."
    )
JWT_ALGORITHM = "HS256"
security = HTTPBearer(auto_error=False)

# Feature flags / safety switches
# Seed/bootstrap endpoints are destructive and must be explicitly enabled (off in production).
ENABLE_SEED_ROUTES = os.environ.get('ENABLE_SEED_ROUTES', 'false').strip().lower() in ('1', 'true', 'yes')
# Whether one-time OTP codes may be returned in HTTP responses. NEVER in production; dev-only convenience.
OTP_EXPOSE_CODE = (not IS_PRODUCTION) and os.environ.get('OTP_EXPOSE_CODE', 'true').strip().lower() in ('1', 'true', 'yes')

# Stripe
STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY', 'sk_test_emergent')
STRIPE_API_KEY = STRIPE_SECRET_KEY
stripe.api_key = STRIPE_SECRET_KEY

# Infobip WhatsApp
INFOBIP_API_KEY = os.environ.get('INFOBIP_API_KEY')
INFOBIP_BASE_URL = os.environ.get('INFOBIP_BASE_URL')
INFOBIP_WHATSAPP_SENDER = os.environ.get('INFOBIP_WHATSAPP_SENDER')

# Unimatrix SMS OTP
UNIMATRIX_API_KEY = os.environ.get('UNIMATRIX_API_KEY', '')
# Registered Sender ID (Unimatrix → Messaging → Senders). Sending FROM an approved sender is what
# lets Lebanese carriers deliver the FIRST message instead of filtering it. Must match exactly.
UNIMATRIX_SIGNATURE = os.environ.get('UNIMATRIX_SIGNATURE', 'OpenMarketlb')

# OpenAI
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
OPENAI_MODEL = os.environ.get('OPENAI_MODEL', 'gpt-4o-mini')

# SMTP Email
SMTP_HOST = os.environ.get('SMTP_HOST', 'smtp.gmail.com')
SMTP_PORT = int(os.environ.get('SMTP_PORT', '587'))
SMTP_USER = os.environ.get('SMTP_USER', '')
SMTP_PASS = os.environ.get('SMTP_PASS', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', SMTP_USER)
SENDER_NAME = os.environ.get('SENDER_NAME', 'OpenMarketlb')

# OTP
OTP_EXPIRY_MINUTES = 5
OTP_COOLDOWN_SECONDS = 30
OTP_MAX_ATTEMPTS = 5
# Carrier first-message workaround: some networks (e.g. Lebanon) silently drop the FIRST SMS from
# an unregistered sender but deliver a retry. When enabled, the SAME code is re-sent once, a few
# seconds later, in the background — so the user receives it without tapping "resend".
# Doubles OTP SMS cost. Disable by setting OTP_DOUBLE_SEND=false. Proper fix = register a Sender ID.
OTP_DOUBLE_SEND = os.environ.get('OTP_DOUBLE_SEND', 'true').strip().lower() in ('1', 'true', 'yes')
OTP_RESEND_DELAY_SECONDS = int(os.environ.get('OTP_RESEND_DELAY_SECONDS', '25'))
