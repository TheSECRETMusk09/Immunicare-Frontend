import React, { useEffect, useRef } from 'react';

const DOMTest = () => {
  const buttonRef = useRef(null);
  const countRef = useRef(0);

  useEffect(() => {
    const button = buttonRef.current;
    console.log('Button ref:', button);
    
    const handleClick = () => {
      console.log('Direct DOM click');
      countRef.current += 1;
      document.getElementById('count').textContent = countRef.current;
    };
    
    if (button) {
      button.addEventListener('click', handleClick);
    }
    
    return () => {
      if (button) {
        button.removeEventListener('click', handleClick);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center mb-4">DOM Test</h1>
        
        <div className="text-center mb-4">
          <p className="text-lg text-gray-700">
            Count: <span id="count">0</span>
          </p>
        </div>
        
        <button
          ref={buttonRef}
          id="test-button"
          className="w-full py-3 px-6 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-semibold"
        >
          Click Me (Direct DOM)
        </button>
        
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-500">Using direct DOM event listener</p>
        </div>
      </div>
    </div>
  );
};

export default DOMTest;