# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e6]:
      - img [ref=e8]
      - paragraph [ref=e10]: Checking connection...
    - generic [ref=e11]:
      - link "Go to home page" [ref=e12]:
        - /url: /
        - img [ref=e13]
        - text: Home
      - generic [ref=e18]:
        - generic [ref=e19]:
          - heading "GUARDIAN ACCESS PORTAL" [level=2] [ref=e20]
          - paragraph [ref=e21]: Manage your infant's vaccination schedule and appointments.
        - generic [ref=e22]:
          - textbox "Email or Patient ID" [ref=e24]
          - generic [ref=e26]:
            - textbox "Password" [ref=e27]
            - button "Show guardian password" [ref=e28] [cursor=pointer]:
              - img
          - link "Forgot Password?" [ref=e31]:
            - /url: /forgot-password
          - generic [ref=e33]:
            - checkbox "Remember me" [ref=e35] [cursor=pointer]
            - generic [ref=e36]:
              - text: Remember me
              - paragraph [ref=e37]: Keep me signed in on this device
          - button "Sign In" [ref=e38] [cursor=pointer]
        - paragraph [ref=e40]:
          - text: Don't have an account?
          - link "Register here" [ref=e41]:
            - /url: /register
      - paragraph [ref=e43]: © 2026 Immunicare. All rights reserved.
  - generic "Notifications"
```