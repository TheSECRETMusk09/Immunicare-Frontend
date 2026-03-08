import React from "react";

const TestComponent = () => {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "white",
        padding: "20px",
        fontFamily: "Arial, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <h1>Test Page</h1>
      <p>This is a minimal test component</p>
      <button
        style={{
          padding: "10px 20px",
          margin: "10px",
          backgroundColor: "blue",
          color: "white",
          border: "none",
          borderRadius: "5px",
        }}
      >
        Test Button
      </button>
    </div>
  );
};

export default TestComponent;
