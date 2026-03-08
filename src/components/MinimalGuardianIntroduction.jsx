import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const MinimalGuardianIntroduction = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.classList.remove("dark");
    document.documentElement.setAttribute("data-theme", "light");
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'white',
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        textAlign: 'center'
      }}>
        {/* Image */}
        <div style={{ marginBottom: '30px' }}>
          <img
            src="/Nurse_holding_a_baby.png"
            alt="Nurse holding baby"
            style={{ width: '100%', maxWidth: '400px' }}
          />
        </div>

        {/* Heading */}
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: 'bold',
          color: '#1f2937',
          marginBottom: '20px'
        }}>
          Welcome to Immunicare
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: '1.125rem',
          color: '#6b7280',
          marginBottom: '40px',
          maxWidth: '600px',
          marginLeft: 'auto',
          marginRight: 'auto'
        }}>
          Your trusted partner in infant vaccination tracking. Keep your
          little ones safe and healthy with our comprehensive immunization
          management system.
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '300px', margin: '0 auto' }}>
          <button
            onClick={() => navigate("/guardian/login")}
            style={{
              padding: '16px 32px',
              fontSize: '1rem',
              fontWeight: 'bold',
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Guardian Login
          </button>

          <button
            onClick={() => navigate("/register")}
            style={{
              padding: '16px 32px',
              fontSize: '1rem',
              fontWeight: '600',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Create Account
          </button>

          <button
            onClick={() => navigate("/admin/login")}
            style={{
              padding: '8px 16px',
              fontSize: '0.875rem',
              color: '#6b7280',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Admin Login
          </button>

          <button
            onClick={() => navigate("/")}
            style={{
              padding: '8px 16px',
              fontSize: '0.875rem',
              color: '#6b7280',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Home
          </button>
        </div>

        {/* Footer */}
        <div style={{ marginTop: '60px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
          <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
            Powered by San Nicolas Health Center
          </p>
        </div>
      </div>
    </div>
  );
};

export default MinimalGuardianIntroduction;
