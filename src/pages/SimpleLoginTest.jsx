import React, { useState, useEffect } from 'react';

const SimpleLoginTest = () => {
  const [role, setRole] = useState('guardian');
  
  useEffect(() => {
    console.log('Component mounted');
    
    const handleGlobalClick = (e) => {
      console.log('Global click event:', e.target);
    };
    
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, []);
  
  const handleButtonClick = (e) => {
    console.log('Button clicked directly:', e);
    setRole(prev => prev === 'guardian' ? 'admin' : 'guardian');
  };
  
  const handleTestButtonClick = () => {
    console.log('Test button clicked');
    alert('Test button clicked!');
  };
  
  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center',
      backgroundColor: '#f5f5f5',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        textAlign: 'center',
        width: '400px'
      }}>
        <h2 style={{ marginBottom: '20px', color: '#333' }}>
          {role === 'guardian' ? 'Guardian Login' : 'Admin Login'}
        </h2>
        
        <p style={{ marginBottom: '20px', color: '#666' }}>
          Current role: {role}
        </p>
        
        <button
          onClick={handleButtonClick}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: 'bold',
            backgroundColor: role === 'guardian' ? '#2196F3' : '#FF9800',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '10px'
          }}
          onMouseDown={(e) => console.log('Mouse down on button:', e)}
          onMouseUp={(e) => console.log('Mouse up on button:', e)}
        >
          Switch to {role === 'guardian' ? 'Admin' : 'Guardian'} Login
        </button>
        
        <button
          onClick={handleTestButtonClick}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: 'bold',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Test Button
        </button>
      </div>
    </div>
  );
};

export default SimpleLoginTest;