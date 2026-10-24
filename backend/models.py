"""
All Pydantic models for the OpenMarket platform.
"""
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid



class UserSignup(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    shop_id: Optional[str] = None


class Shop(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str  # Owner user ID
    name: str
    description: Optional[str] = None
    logo: Optional[str] = None
    banner: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    state: Optional[str] = None
    status: str = "pending"  # pending, approved, suspended
    subscription_required: bool = True  # If False, shop pays no subscription fees
    subscription_status: str = "pending"  # pending, trial, active, expired, cancelled
    subscription_start: Optional[datetime] = None
    subscription_end: Optional[datetime] = None
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    payment_method: str = "manual"  # manual only (card removed)
    subscription_price_paid: Optional[float] = None
    commission_percentage: Optional[float] = None  # Per-shop commission override (uses platform default if None)
    commission_type: str = "on_customer"  # on_shop, on_customer, half_half
    category_ids: List[str] = []  # Shop categories (from categories collection)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ShopCreate(BaseModel):
    name: str
    description: Optional[str] = None
    logo: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    state: Optional[str] = None
    category_ids: Optional[List[str]] = None
    referral_code: Optional[str] = None


class ShopUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    logo: Optional[str] = None
    banner: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_address: Optional[str] = None
    category_ids: Optional[List[str]] = None


class PlatformSettings(BaseModel):
    subscription_price: float = 29.0
    trial_days: int = 7
    commission_enabled: bool = True
    commission_percentage: float = 10.0
    card_subscription_enabled: bool = False  # Off by default
    card_payment_enabled: bool = False  # Off by default
    type_images: Optional[Dict[str, str]] = None  # Images for men/women/kids sections
    primary_color: Optional[str] = "#3bf4fb"    # Brand primary (hex) — themes web + mobile
    secondary_color: Optional[str] = "#caff8a"  # Brand secondary (hex) — themes web + mobile


class State(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    delivery_fee: float = 0.0
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StateCreate(BaseModel):
    name: str
    delivery_fee: float = 0.0
    is_active: bool = True


class Category(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    image: Optional[str] = None  # Category image URL
    parent_id: Optional[str] = None  # For hierarchical categories
    level: int = 1  # 1 = root, 2 = child, 3 = grandchild
    is_active: bool = True  # Show/hide in user filtering
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    image: Optional[str] = None
    parent_id: Optional[str] = None
    is_active: bool = True


class ColorVariant(BaseModel):
    color_name: str
    color_code: Optional[str] = "#CCCCCC"  # Hex code like #FF0000, default gray
    image_url: str
    stock: int = 0  # Stock for this specific color
    price: Optional[float] = None  # Per-variant price (optional)
    discount_price: Optional[float] = None  # Per-variant sale price (optional)


class SizeVariant(BaseModel):
    size_name: str  # XXS, XS, S, M, L, XL, 2XL, 3XL or custom
    image_url: Optional[str] = None  # Optional per-size image
    stock: int = 0
    price: Optional[float] = None
    discount_price: Optional[float] = None


class ShapeVariant(BaseModel):
    shape_name: str
    image_url: str
    stock: int = 0
    price: Optional[float] = None
    discount_price: Optional[float] = None


class TypeVariant(BaseModel):
    """A 'type' variant — for products that come in specific models/editions.
    Example: Samsung Galaxy S24, Galaxy S24 Ultra, Galaxy S24 FE."""
    type_name: str
    image_url: Optional[str] = None  # Optional per-type image
    stock: int = 0
    price: Optional[float] = None
    discount_price: Optional[float] = None


class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    shop_id: Optional[str] = None  # For multi-vendor
    shop_name: Optional[str] = None  # Denormalized for display
    name: str
    description: str
    category_id: Optional[str] = None  # Keep for backward compatibility
    category_ids: List[str] = []  # Multiple categories
    type: Optional[str] = None  # men, women, kids (audience – legacy field, do not confuse with type variants)
    price: float
    discount_price: Optional[float] = None
    original_price: Optional[float] = None  # Original price before commission markup
    original_discount_price: Optional[float] = None  # Original discount price before commission markup
    stock: int
    images: List[str] = []
    colors: List[ColorVariant] = []  # Color variants with photos
    sizes: List[SizeVariant] = []  # Size variants
    shapes: List[ShapeVariant] = []  # Shape variants
    types: List[TypeVariant] = []  # 4th variant: Type (e.g., Samsung Galaxy S24)
    has_color_variants: bool = False
    has_size_variants: bool = False
    has_shape_variants: bool = False
    has_type_variants: bool = False
    use_same_price: bool = False  # Use same price for all variants
    use_same_photo_sizes: bool = False  # Use same photo for all size variants
    size_variant_image: Optional[str] = None  # Shared image for size variants
    use_same_photo_types: bool = False  # Use same photo for all type variants
    type_variant_image: Optional[str] = None  # Shared image for type variants
    variant_selection_mode: str = "single"  # "single" = one variant type only, "multi" = can select from multiple types (e.g. color+size for clothes)
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProductCreate(BaseModel):
    name: str
    description: str
    category_id: Optional[str] = None  # Keep for backward compatibility
    category_ids: Optional[List[str]] = None  # Multiple categories
    type: Optional[str] = None  # men, women, kids (audience – legacy field)
    price: float
    discount_price: Optional[float] = None
    stock: int = 0
    images: List[str] = []
    colors: Optional[List[Dict[str, Any]]] = None  # Color variants
    sizes: Optional[List[Dict[str, Any]]] = None  # Size variants
    shapes: Optional[List[Dict[str, Any]]] = None  # Shape variants
    types: Optional[List[Dict[str, Any]]] = None  # Type variants (4th variant)
    has_color_variants: bool = False
    has_size_variants: bool = False
    has_shape_variants: bool = False
    has_type_variants: bool = False
    use_same_price: bool = False
    use_same_photo_sizes: bool = False
    size_variant_image: Optional[str] = None
    use_same_photo_types: bool = False
    type_variant_image: Optional[str] = None
    variant_selection_mode: str = "single"  # "single" or "multi"
    is_active: bool = True
    shop_id: Optional[str] = None  # Admin can assign product to a shop


class CartItem(BaseModel):
    product_id: str
    quantity: int
    selected_color: Optional[str] = None  # Color name for color-specific orders
    selected_size: Optional[str] = None  # Size name for size-specific orders
    selected_shape: Optional[str] = None  # Shape name for shape-specific orders
    selected_type: Optional[str] = None  # Type name for type-specific orders (e.g., 'Galaxy S24 Ultra')


class Cart(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    items: List[CartItem] = []
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AddToCart(BaseModel):
    product_id: str
    quantity: int = 1
    selected_color: Optional[str] = None  # Color name for color-specific stock
    selected_size: Optional[str] = None  # Size name for size-specific stock
    selected_shape: Optional[str] = None  # Shape name for shape-specific stock
    selected_type: Optional[str] = None  # Type name for type-specific stock


class UpdateCart(BaseModel):
    product_id: str
    quantity: int


class Order(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None
    guest_name: Optional[str] = None
    guest_email: Optional[str] = None
    guest_phone: Optional[str] = None
    shipping_address: Dict[str, str]
    items: List[Dict[str, Any]]
    total_amount: float
    delivery_fee: float = 1.0
    commission_amount: float = 0.0
    payment_method: str
    payment_status: str = "pending"
    order_status: str = "pending"
    payout_status: str = "pending"  # pending, paid - for card payments shop payouts
    # Multi-vendor fields
    shop_ids: List[str] = []  # Shops involved in this order
    delivery_user_id: Optional[str] = None  # Assigned delivery user
    delivery_status: str = "pending"  # pending, picked_up, in_transit, delivered
    delivery_notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class OrderCreate(BaseModel):
    guest_name: Optional[str] = None
    guest_email: Optional[str] = None
    guest_phone: Optional[str] = None
    user_phone: Optional[str] = None
    shipping_address: Dict[str, str]
    payment_method: str
    loyalty_points_to_redeem: Optional[int] = 0
    customer_location: Optional[Dict[str, float]] = None  # {lat, lng}


class Wishlist(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    product_ids: List[str] = []
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PaymentTransaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    user_id: Optional[str] = None
    amount: float
    currency: str
    metadata: Dict[str, Any]
    payment_status: str = "pending"
    status: str = "initiated"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ContactMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    phone_number: Optional[str] = None
    message: str
    message_type: str = "general"  # general, bug, suggestion, complaint, partnership
    photo: Optional[str] = None
    status: str = "unread"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ContactMessageCreate(BaseModel):
    name: str
    email: str
    phone_number: Optional[str] = None
    message: str
    message_type: Optional[str] = "general"
    photo: Optional[str] = None


class ProductReview(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: str
    user_id: str
    user_name: str
    user_email: Optional[str] = None
    rating: int  # 1-5 stars
    title: Optional[str] = None
    comment: str
    is_verified_purchase: bool = False  # Did user actually buy this product
    helpful_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProductReviewCreate(BaseModel):
    rating: int  # 1-5
    title: Optional[str] = None
    comment: str


class SiteSettings(BaseModel):
    id: str = "site_settings"
    contact_email: str = "contact@openmarketlb.com"
    contact_phone: str = "12-345-6789"
    hero_image_1: str = "https://images.pexels.com/photos/7772182/pexels-photo-7772182.jpeg"
    hero_image_2: str = "https://images.pexels.com/photos/3769747/pexels-photo-3769747.jpeg"
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SiteSettingsUpdate(BaseModel):
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    hero_image_1: Optional[str] = None
    hero_image_2: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None


class AdminProfileUpdate(BaseModel):
    email: Optional[str] = None
    old_password: Optional[str] = None
    new_password: Optional[str] = None


class PhoneOTPRequest(BaseModel):
    phone_number: str
    purpose: Optional[str] = "checkout"


class PhoneOTPVerify(BaseModel):
    phone_number: str
    code: str
    purpose: Optional[str] = "checkout"


class LoginStart(BaseModel):
    email: str
    password: str


class LoginVerifyOTP(BaseModel):
    challenge_id: str
    code: str


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: str = "user"  # user, admin, delivery
    phone: Optional[str] = None
    phone_verified: Optional[bool] = False
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None


class CreatePaymentIntentRequest(BaseModel):
    shop_name: str
    description: Optional[str] = None
    logo: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    months: int = 1


class ShopCreateOrderRequest(BaseModel):
    customer_name: str
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    shipping_address: Dict[str, str]
    items: list  # [{product_id, quantity, selected_color}]
    payment_method: str = "cod"  # "cod", "card", "wallet"


class AdminShopUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    commission_percentage: Optional[float] = None
    commission_type: Optional[str] = None  # on_shop, on_customer, half_half
    subscription_required: Optional[bool] = None
    logo: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    category_ids: Optional[List[str]] = None


class MessageCreate(BaseModel):
    recipient_id: Optional[str] = None  # Single recipient (shop_id or user_id)
    recipient_ids: Optional[List[str]] = []  # Multiple recipients
    recipient_type: str  # "shop", "admin", "customer"
    send_to_all_shops: bool = False  # If True, send to all shops
    send_to_all_users: bool = False  # If True (admin only), send to all customers
    subject: Optional[str] = None
    message: str = ""
    image_url: Optional[str] = None  # Optional photo/image attachment
    # Rich attachments: photo / document / product
    attachment_type: Optional[str] = None  # "image" | "document" | "product"
    attachment_url: Optional[str] = None    # url for image/document
    attachment_name: Optional[str] = None   # original filename for documents
    product_id: Optional[str] = None        # product reference (must belong to the shop being messaged)


class MessagingBlockRequest(BaseModel):
    entity_type: str  # "customer" | "shop"
    entity_id: str


class MessageResponse(BaseModel):
    id: str
    sender_id: str
    sender_type: str  # "admin", "shop", "customer"
    sender_name: Optional[str] = None
    recipient_id: str
    recipient_type: str
    recipient_name: Optional[str] = None
    subject: Optional[str] = None
    message: str
    is_read: bool = False
    created_at: datetime
    conversation_id: str  # Groups messages between same parties


class Notification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    recipient_type: str  # "admin", "shop"
    recipient_id: Optional[str] = None  # shop_id for shop notifications
    title: str
    message: str
    type: str  # "order", "product", "subscription", "user", "system"
    link: Optional[str] = None  # URL to navigate to
    is_read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class LoyaltyRedeemPreview(BaseModel):
    points_to_redeem: int
    cart_total: float


class LoyaltyRedeem(BaseModel):
    points_to_redeem: int


# ============= EMPLOYEE MODELS (formerly "Agent" — internal staff with admin page access) =============
class EmployeeCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: str
    password: str
    address: Optional[str] = None
    state: Optional[str] = None
    allowed_pages: Optional[List[str]] = None  # Pages employee can access


class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password: Optional[str] = None
    address: Optional[str] = None
    state: Optional[str] = None
    allowed_pages: Optional[List[str]] = None


# Backward-compat aliases (some older code still imports AgentCreate/AgentUpdate names)
AgentCreate = EmployeeCreate
AgentUpdate = EmployeeUpdate


# ============= REFERRAL AGENT MODELS (NEW — agents who refer shops and earn commission) =============
class ReferralAgentCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr  # Must end with @agent.com per business rule
    phone: str
    password: str
    address: Optional[str] = None
    state: Optional[str] = None
    # Per-agent settings (optional, fall back to defaults if not provided)
    commission_share_percent: Optional[float] = None  # % of admin's commission this agent earns (default 30%)
    approval_bonus_amount: Optional[float] = None  # $ added to wallet when a referred shop is approved (default 4)


class ReferralAgentUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password: Optional[str] = None
    address: Optional[str] = None
    state: Optional[str] = None
    commission_share_percent: Optional[float] = None
    approval_bonus_amount: Optional[float] = None


class AgentFillShopRequest(BaseModel):
    """Used by an agent to submit a shop application on behalf of a shop owner.
    Creates a guest_shop_application marked as referred by this agent.
    """
    shop_name: str
    description: Optional[str] = None
    email: EmailStr  # Shop owner's email
    phone: str
    address: Optional[str] = None
    state: Optional[str] = None
    guest_name: Optional[str] = None  # Owner's name
    category_ids: Optional[List[str]] = None
    logo: Optional[str] = None


class AgentCashoutRequest(BaseModel):
    amount: float
    method: Optional[str] = None  # cash | whish | omt
    method_number: Optional[str] = None  # phone/account number (required for whish & omt)
    note: Optional[str] = None
