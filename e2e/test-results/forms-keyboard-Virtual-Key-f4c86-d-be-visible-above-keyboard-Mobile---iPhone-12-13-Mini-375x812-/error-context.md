# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - link "Go to home page" [ref=e4]:
      - /url: /
      - img [ref=e5]
      - text: Home
    - generic [ref=e10]:
      - generic [ref=e11]:
        - heading "GUARDIAN ACCESS PORTAL" [level=2] [ref=e12]
        - paragraph [ref=e13]: Manage your infant's vaccination schedule and appointments.
      - generic [ref=e14]:
        - textbox "Email or Patient ID" [ref=e16]
        - generic [ref=e18]:
          - textbox "Password" [ref=e19]
          - button "Show guardian password" [ref=e20] [cursor=pointer]:
            - img
        - link "Forgot Password?" [ref=e23]:
          - /url: /forgot-password
        - generic [ref=e25]:
          - checkbox "Remember me" [ref=e27] [cursor=pointer]
          - generic [ref=e28]:
            - text: Remember me
            - paragraph [ref=e29]: Keep me signed in on this device
        - button "Sign In" [ref=e30] [cursor=pointer]
      - paragraph [ref=e32]:
        - text: Don't have an account?
        - link "Register here" [ref=e33]:
          - /url: /register
    - paragraph [ref=e35]: © 2026 Immunicare. All rights reserved.
  - generic "Notifications"
```