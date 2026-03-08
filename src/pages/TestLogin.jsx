import React, { useState, useEffect } from 'react';
import { Plus, Baby, Shield } from 'lucide-react';

const TestLogin = () => {
  const [role, setRole] = useState('guardian');

  console.log('TestLogin component rendering');

  const handleRoleChange = (newRole) => {
    console.log('handleRoleChange called with:', newRole);
    setRole(newRole);
  };

  useEffect(() => {
    console.log('Role changed to:', role);
  }, [role]);

  // Global click listener for debugging
  useEffect(() => {
    const handleGlobalClick = (e) => {
      console.log('Global click event:', e.target);
    };
    
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, []);

  // Direct DOM listener for the button
  useEffect(() => {
    const button = document.getElementById('switch-to-admin-btn');
    console.log('Button element:', button); // Check if button is found
    if (button) {
      const handleButtonClick = () => {
        console.log('Direct DOM click listener');
        handleRoleChange('admin');
      };
      button.addEventListener('click', handleButtonClick);
      return () => button.removeEventListener('click', handleButtonClick);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-8 font-sans">
      <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
        Test Login Page
      </h1>
      
      <div className="max-w-4xl mx-auto">
        {/* Current Role Display */}
        <div className="text-center mb-8 p-4 bg-blue-50 rounded-lg">
          <h2 className="text-xl font-semibold text-blue-800">
            Current Role: {role.toUpperCase()}
          </h2>
          <p className="text-blue-600 mt-1">Click the button below to switch roles</p>
        </div>

        {/* Two Panel Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-h-[600px]">
          {/* Left Panel - Branding or Login Form */}
          <div className="bg-white rounded-lg shadow-lg p-6 flex flex-col justify-center">
            {role === 'guardian' ? (
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-md">
                  <Plus size={32} className="text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">IMMUNICARE</h2>
                <p className="text-gray-600 mb-4">Infant Vaccination & Inventory</p>
                <p className="text-gray-500 text-sm mb-6">
                  Track immunization schedules and receive reminders for your child's vaccinations.
                </p>
                
                <button
                  id="switch-to-admin-btn"
                  onClick={() => {
                    console.log('Switch button clicked directly');
                    handleRoleChange('admin');
                  }}
                  className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold"
                >
                  Switch to Admin Portal
                </button>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-md">
                  <Shield size={32} className="text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">ADMIN PORTAL</h2>
                <p className="text-gray-600 mb-4">Healthcare Management System</p>
                <p className="text-gray-500 text-sm mb-6">
                  Manage vaccination records, inventory, and appointments.
                </p>
                
                <button
                  onClick={() => {
                    console.log('Switch button clicked directly');
                    handleRoleChange('guardian');
                  }}
                  className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors font-semibold"
                >
                  Switch to Guardian Portal
                </button>
              </div>
            )}
          </div>

          {/* Right Panel - Login Form */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg shadow-lg p-6 flex flex-col justify-center text-white">
            {role === 'guardian' ? (
              <div className="max-w-md mx-auto">
                <div className="text-center mb-8">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center shadow-lg">
                    <Baby size={40} className="text-white" />
                  </div>
                  <h2 className="text-2xl font-bold">Guardian Login</h2>
                  <p className="text-white/80 mt-2">
                    Access your infant's vaccination records
                  </p>
                </div>
                
                <form className="space-y-4">
                  <input
                    type="text"
                    placeholder="Email or Guardian ID"
                    className="w-full px-4 py-3 rounded-lg bg-white text-gray-900"
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    className="w-full px-4 py-3 rounded-lg bg-white text-gray-900"
                  />
                  <button
                    type="submit"
                    className="w-full bg-red-500 hover:bg-red-600 py-3 rounded-lg text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    Sign In
                  </button>
                </form>
              </div>
            ) : (
              <div className="max-w-md mx-auto">
                <div className="text-center mb-8">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center shadow-lg">
                    <Shield size={40} className="text-white" />
                  </div>
                  <h2 className="text-2xl font-bold">Admin Login</h2>
                  <p className="text-white/80 mt-2">
                    Health Center Management Portal
                  </p>
                </div>
                
                <form className="space-y-4">
                  <input
                    type="text"
                    placeholder="Username"
                    className="w-full px-4 py-3 rounded-lg bg-white text-gray-900"
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    className="w-full px-4 py-3 rounded-lg bg-white text-gray-900"
                  />
                  <button
                    type="submit"
                    className="w-full bg-red-500 hover:bg-red-600 py-3 rounded-lg text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    System Login
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestLogin;