import React, { useEffect, useState, useContext } from 'react';
import BrandName from '../components/BrandName';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '../lib/api';
import { AuthContext } from '../App';

const SubscriptionSuccessPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, setUser } = useContext(AuthContext);
  const [status, setStatus] = useState('verifying'); // verifying, success, failed
  const [message, setMessage] = useState('');
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // Give AuthContext time to initialize
    const timer = setTimeout(() => setAuthChecked(true), 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!authChecked) return; // Wait for auth to be checked
    
    const sessionId = searchParams.get('session_id');
    const token = localStorage.getItem('token');
    
    // If we have a token but no user, try to verify anyway
    if (sessionId && token) {
      verifyPayment(sessionId);
    } else if (!token) {
      // Only redirect to login if there's no token at all
      navigate('/auth');
    }
  }, [searchParams, user, authChecked]);

  const verifyPayment = async (sessionId) => {
    try {
      const { data } = await api.shop.verifySubscription(sessionId);
      if (data.status === 'active') {
        setStatus('success');
        setMessage(data.expires ? `Your subscription is valid until ${new Date(data.expires).toLocaleDateString()}` : 'Your subscription is now active!');
        
        // Update token and user with the new data from backend
        if (data.token) {
          localStorage.setItem('token', data.token);  // Store new token with updated role
        }
        if (data.user) {
          setUser(data.user);  // Update context with new user data
          localStorage.setItem('user', JSON.stringify(data.user));
        }
        
        // Auto redirect to shop dashboard after 2 seconds
        setTimeout(() => {
          navigate('/shop/dashboard');
        }, 2000);
      } else {
        setStatus('failed');
        setMessage('Payment verification failed. Please contact support.');
      }
    } catch (error) {
      setStatus('failed');
      setMessage(error.response?.data?.detail || 'Failed to verify payment');
    }
  };

  if (status === 'verifying') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-16 w-16 animate-spin text-emerald-600 mx-auto mb-6" />
          <h1 className="text-2xl font-heading font-bold mb-2">Verifying Payment</h1>
          <p className="text-slate-600">Please wait while we confirm your subscription...</p>
        </div>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="h-10 w-10 text-red-600" />
          </div>
          <h1 className="text-3xl font-heading font-bold mb-4">Payment Failed</h1>
          <p className="text-slate-600 mb-8">{message}</p>
          <div className="space-y-3">
            <Button onClick={() => navigate('/become-seller')} className="w-full">
              Try Again
            </Button>
            <Button variant="outline" onClick={() => navigate('/')} className="w-full">
              Go to Homepage
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="h-10 w-10 text-emerald-600" />
        </div>
        <h1 className="text-3xl font-heading font-bold mb-4" data-testid="subscription-success-title">
          Subscription Activated!
        </h1>
        <p className="text-slate-600 mb-2">Your payment was successful.</p>
        <p className="text-emerald-600 font-semibold mb-8">{message}</p>
        
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-8">
          <p className="text-emerald-800">
            You can now add products, manage orders, and start selling on <span className="font-semibold"><BrandName showLb /></span>!
          </p>
          <p className="text-emerald-600 text-sm mt-2">
            Redirecting to your shop dashboard in a moment...
          </p>
        </div>
        
        <Button 
          onClick={() => navigate('/shop/dashboard')} 
          className="w-full bg-emerald-600 hover:bg-emerald-700"
          data-testid="go-to-dashboard-btn"
        >
          Go to Shop Dashboard
        </Button>
      </div>
    </div>
  );
};

export default SubscriptionSuccessPage;
