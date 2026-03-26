import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCLq-y5GYMCj7a7vMXFRqmVX0Vv9Qr4cM8",
  authDomain: "fuel-trang.firebaseapp.com",
  projectId: "fuel-trang",
  storageBucket: "fuel-trang.firebasestorage.app",
  messagingSenderId: "1040467183574",
  appId: "1:1040467183574:web:71fab02e298a59a72e8677",
  measurementId: "G-2BSG2WYXYY"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
