import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Register from './Register';
import { AuthProvider } from '../contexts/AuthContext';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import apiClient from '../utils/api';

// Mock dependencies
jest.mock('../hooks/useNetworkStatus');
jest.mock('../utils/api');

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  Link: ({ children, to }) => <a href={to}>{children}</a>,
}));

const renderComponent = () => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <Register />
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('Register Component', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    useNetworkStatus.mockReturnValue({ isOnline: true, isBackendReachable: true });
    apiClient.register.mockResolvedValue({ data: { message: 'Verification code sent' } });
    apiClient.verifyGuardianRegistration.mockResolvedValue({ data: { message: 'Registration successful' } });
    apiClient.resendGuardianRegistrationOtp.mockResolvedValue({ data: { message: 'Verification code resent' } });
  });

  test('renders the registration form', () => {
    renderComponent();
    expect(screen.getByRole('heading', { name: /Create Your Account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/First Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Last Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Phone Number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirm Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Account/i })).toBeInTheDocument();
  });
  
});
