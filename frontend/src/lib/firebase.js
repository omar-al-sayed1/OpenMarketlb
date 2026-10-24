import { initializeApp, getApps } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// Initialize Firebase only once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

// Disable app verification for testing (remove in production)
// auth.settings.appVerificationDisabledForTesting = true;

// Setup reCAPTCHA verifier - using normal size for better compatibility
export const setupRecaptcha = (containerId) => {
  // Clear any existing verifier
  if (window.recaptchaVerifier) {
    try {
      window.recaptchaVerifier.clear();
    } catch (e) {
      console.log('Error clearing recaptcha:', e);
    }
    window.recaptchaVerifier = null;
  }
  
  // Clear the container
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = '';
  }

  window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: 'normal',
    callback: (response) => {
      console.log('reCAPTCHA solved:', response);
    },
    'expired-callback': () => {
      console.log('reCAPTCHA expired');
      window.recaptchaVerifier = null;
    }
  });
  
  return window.recaptchaVerifier;
};

// Render the reCAPTCHA widget
export const renderRecaptcha = async (containerId) => {
  try {
    const verifier = setupRecaptcha(containerId);
    await verifier.render();
    return true;
  } catch (error) {
    console.error('Error rendering reCAPTCHA:', error);
    return false;
  }
};

// Send OTP to phone number
export const sendOTP = async (phoneNumber) => {
  try {
    if (!window.recaptchaVerifier) {
      return { success: false, message: 'Please complete the reCAPTCHA first' };
    }
    
    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, window.recaptchaVerifier);
    window.confirmationResult = confirmationResult;
    return { success: true, message: 'OTP sent successfully' };
  } catch (error) {
    console.error('Error sending OTP:', error);
    
    // Reset reCAPTCHA on error
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear();
      } catch (e) {
        console.log('Error clearing recaptcha:', e);
      }
      window.recaptchaVerifier = null;
    }
    
    let errorMessage = error.message;
    if (error.code === 'auth/invalid-phone-number') {
      errorMessage = 'Invalid phone number format. Please use international format.';
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage = 'Too many requests. Please try again later.';
    } else if (error.code === 'auth/network-request-failed') {
      errorMessage = 'Network error. Please check your connection and try again.';
    }
    
    return { success: false, message: errorMessage, code: error.code };
  }
};

// Verify OTP code
export const verifyOTP = async (otpCode) => {
  try {
    if (!window.confirmationResult) {
      return { success: false, message: 'Please request OTP first' };
    }
    const result = await window.confirmationResult.confirm(otpCode);
    return { success: true, user: result.user, phoneNumber: result.user.phoneNumber };
  } catch (error) {
    console.error('Error verifying OTP:', error);
    let errorMessage = 'Invalid OTP code';
    if (error.code === 'auth/invalid-verification-code') {
      errorMessage = 'Invalid verification code. Please try again.';
    } else if (error.code === 'auth/code-expired') {
      errorMessage = 'Verification code expired. Please request a new one.';
    }
    return { success: false, message: errorMessage };
  }
};

// Sign out (cleanup after verification)
export const signOutFirebase = async () => {
  try {
    await auth.signOut();
    window.confirmationResult = null;
  } catch (error) {
    console.error('Error signing out:', error);
  }
};

export { auth };
