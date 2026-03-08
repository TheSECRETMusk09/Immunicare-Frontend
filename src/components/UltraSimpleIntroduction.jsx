import React from "react";
import { useNavigate } from "react-router-dom";

const UltraSimpleIntroduction = () => {
  const navigate = useNavigate();

  return (
    <div>
      <h1>Welcome to Immunicare</h1>
      <p>Your trusted partner in infant vaccination tracking.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <button onClick={() => navigate("/guardian/login")}>
          Guardian Login
        </button>
        <button onClick={() => navigate("/register")}>Create Account</button>
        <button onClick={() => navigate("/admin/login")}>Admin Login</button>
      </div>
    </div>
  );
};

export default UltraSimpleIntroduction;
