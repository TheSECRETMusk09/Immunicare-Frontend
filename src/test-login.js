import axios from "axios";
import { API_BASE_URL } from "./utils/apiConfig";

async function testLogin() {
  console.log("Testing frontend login process...");

  // Test 1: Admin login with username
  try {
    console.log("1. Testing admin login with username:");
    const response = await axios.post(
      `${API_BASE_URL}/auth/login`,
      {
        username: "admin",
        password: "Admin2024!",
        rememberMe: true,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        withCredentials: true,
        timeout: 10000,
      },
    );

    console.log("✅ Success:", response.data);
    console.log("");
  } catch (error) {
    console.log("❌ Error:", error.response?.data || error.message);
    console.log("");
  }

  // Test 2: Guardian login with username
  try {
    console.log("2. Testing guardian login with username:");
    const response = await axios.post(
      `${API_BASE_URL}/auth/login`,
      {
        username: "maria.dela.cruz",
        password: "Guardian123!",
        rememberMe: false,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        withCredentials: true,
        timeout: 10000,
      },
    );

    console.log("✅ Success:", response.data);
    console.log("");
  } catch (error) {
    console.log("❌ Error:", error.response?.data || error.message);
    console.log("");
  }

  // Test 3: Guardian login with email
  try {
    console.log("3. Testing guardian login with email:");
    const response = await axios.post(
      `${API_BASE_URL}/auth/login`,
      {
        email: "maria.dela.cruz@email.com",
        password: "Guardian123!",
        rememberMe: false,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        withCredentials: true,
        timeout: 10000,
      },
    );

    console.log("✅ Success:", response.data);
    console.log("");
  } catch (error) {
    console.log("❌ Error:", error.response?.data || error.message);
    console.log("");
  }
}

testLogin();
