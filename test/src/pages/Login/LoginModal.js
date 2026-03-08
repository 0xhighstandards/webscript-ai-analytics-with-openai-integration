import { useState } from "react";
import { FaGoogle, FaFacebookF } from "react-icons/fa";
import { useGoogleLogin } from "@react-oauth/google";
import FacebookLogin from "@greatsumini/react-facebook-login";
import "./login.css";

const FACEBOOK_APP_ID = process.env.REACT_APP_FACEBOOK_APP_ID;

function LoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const userInfo = await res.json();

        const email = userInfo.email;
        const name = userInfo.name || email.split("@")[0];
        const avatar = userInfo.picture || "https://i.pravatar.cc/40";

        localStorage.setItem("user_email", email);

        const profiles = JSON.parse(localStorage.getItem("user_profiles")) || {};
        if (!profiles[email]) {
          profiles[email] = { username: name, avatar };
          localStorage.setItem("user_profiles", JSON.stringify(profiles));
        }

        const users = JSON.parse(localStorage.getItem("users")) || [];
        const exists = users.find((u) => u.email === email);
        if (!exists) {
          users.push({ email, password: null, provider: "google" });
          localStorage.setItem("users", JSON.stringify(users));
        }

        const userChatsKey = `user_chats_${email}`;
        if (!localStorage.getItem(userChatsKey)) {
          localStorage.setItem(userChatsKey, JSON.stringify([]));
        }

        onLoginSuccess();
      } catch (err) {
        setError("Google sign-in failed. Please try again.");
      }
    },
    onError: () => setError("Google sign-in was cancelled or failed."),
  });

  const handleFacebookSuccess = (response) => {
    try {
      // ✅ Strict validation
      if (!response || !response.id || !response.name) {
        setError("Facebook sign-in failed. Please try again.");
        return;
      }

      // ✅ Email fallback since email scope requires app review
      const email = response.email || `fb_${response.id}@facebook.com`;
      const name = response.name;
      const avatar = response.picture?.data?.url || "https://i.pravatar.cc/40";

      localStorage.setItem("user_email", email);

      const profiles = JSON.parse(localStorage.getItem("user_profiles")) || {};
      if (!profiles[email]) {
        profiles[email] = { username: name, avatar };
        localStorage.setItem("user_profiles", JSON.stringify(profiles));
      }

      const users = JSON.parse(localStorage.getItem("users")) || [];
      const exists = users.find((u) => u.email === email);
      if (!exists) {
        users.push({ email, password: null, provider: "facebook" });
        localStorage.setItem("users", JSON.stringify(users));
      }

      const userChatsKey = `user_chats_${email}`;
      if (!localStorage.getItem(userChatsKey)) {
        localStorage.setItem(userChatsKey, JSON.stringify([]));
      }

      onLoginSuccess();
    } catch (err) {
      setError("Facebook sign-in failed. Please try again.");
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    const form = e.target;
    const email = form.email.value;
    const password = form.password.value;

    const users = JSON.parse(localStorage.getItem("users")) || [];
    const profiles = JSON.parse(localStorage.getItem("user_profiles")) || {};
    const userChatsKey = `user_chats_${email}`;

    if (isRegister) {
      const exists = users.find((u) => u.email === email);
      if (exists) {
        setError("Account already exists. Please log in.");
        return;
      }
      users.push({ email, password });
      localStorage.setItem("users", JSON.stringify(users));
      localStorage.setItem("user_email", email);
      if (!profiles[email]) {
        profiles[email] = { username: email.split("@")[0], avatar: "https://i.pravatar.cc/40" };
        localStorage.setItem("user_profiles", JSON.stringify(profiles));
      }
      if (!localStorage.getItem(userChatsKey)) {
        localStorage.setItem(userChatsKey, JSON.stringify([]));
      }
      onLoginSuccess();
    } else {
      const validUser = users.find((u) => u.email === email && u.password === password);
      if (!validUser) {
        setError("Account not found. Please register first.");
        return;
      }
      localStorage.setItem("user_email", email);
      if (!profiles[email]) {
        profiles[email] = { username: email.split("@")[0], avatar: "https://i.pravatar.cc/40" };
        localStorage.setItem("user_profiles", JSON.stringify(profiles));
      }
      if (!localStorage.getItem(userChatsKey)) {
        localStorage.setItem(userChatsKey, JSON.stringify([]));
      }
      onLoginSuccess();
    }
  };

  return (
    <div className="login-overlay" onClick={onClose}>
      <div className="login-modal pop" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>×</button>
        <h2>{isRegister ? "Create Account" : "Welcome Back"}</h2>

        <div className="social-login">
          <button className="social-btn google" onClick={() => handleGoogleLogin()}>
            <FaGoogle className="social-icon" />
            Continue with Google
          </button>

          {/* ✅ Removed email scope, using only public_profile */}
          <FacebookLogin
            appId={FACEBOOK_APP_ID}
            fields="name,picture"
            scope="public_profile"
            onSuccess={handleFacebookSuccess}
            onFail={(err) => {
              console.log("Facebook failed:", err);
              setError("Facebook sign-in failed. Please try again.");
            }}
            autoLoad={false}
            render={({ onClick }) => (
              <button className="social-btn facebook" onClick={onClick}>
                <FaFacebookF className="social-icon" />
                Continue with Facebook
              </button>
            )}
          />
        </div>

        <div className="divider-text"><span>or</span></div>

        <form className="login-form" onSubmit={handleSubmit}>
          <input type="email" name="email" placeholder="Email address" required />
          <input type="password" name="password" placeholder="Password" required />
          {error && <p className="error-text">{error}</p>}
          <button type="submit" className="login-btn">
            {isRegister ? "Create Account" : "Login"}
          </button>
        </form>

        <div className="login-footer">
          <p>
            {isRegister ? "Already have an account?" : "New to WebScript AI?"}
            <span onClick={() => setIsRegister(!isRegister)}>
              {isRegister ? " Login" : " Create Account"}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginModal;