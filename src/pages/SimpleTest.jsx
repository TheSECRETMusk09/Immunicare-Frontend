import React, { useState, useEffect } from 'react';

const SimpleTest = () => {
  const [count, setCount] = useState(0);

  console.log('SimpleTest component rendering');

  const handleClick = () => {
    console.log('Button clicked directly');
    setCount(count + 1);
  };

  useEffect(() => {
    const button = document.getElementById('test-button');
    console.log('Button element:', button);
    
    if (button) {
      const handleDOMClick = () => {
        console.log('DOM click listener');
        setCount(count + 1);
      };
      
      button.addEventListener('click', handleDOMClick);
      return () => button.removeEventListener('click', handleDOMClick);
    }
  }, [count]);

  useEffect(() => {
    const handleGlobalClick = (e) => {
      console.log('Global click:', e.target);
    };
    
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center mb-4">Simple Button Test</h1>
        
        <div className="text-center mb-4">
          <p className="text-lg text-gray-700">Count: {count}</p>
        </div>
        
        <button
          id="test-button"
          onClick={handleClick}
          className="w-full py-3 px-6 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold"
        >
          Click Me
        </button>
        
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-500">Check console for logs</p>
        </div>
      </div>
    </div>
  );
};

export default SimpleTest;