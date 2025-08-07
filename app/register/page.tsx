"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/app/lib/supabaseClient";

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    agreedToTerms: false
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleNext = () => {
    if (step === 1 && (!formData.firstName || !formData.lastName)) return;
    if (step === 2 && !formData.email) return;
    if (step === 3 && formData.password.length < 6) {
      alert("Passwort muss mindestens 6 Zeichen lang sein.");
      return;
    }
    setStep((prev) => prev + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.agreedToTerms) {
      alert("Bitte akzeptiere die Bedingungen.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          firstName: formData.firstName,
          lastName: formData.lastName,
        },
      },
    });
    if (error) {
      alert("❌ Registrierung fehlgeschlagen: " + error.message);
    } else {
      alert("✅ Registrierung erfolgreich! Bitte bestätige deine E-Mail.");
    }
  };

  const variants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black/80 text-white px-4">
      <div className="bg-zinc-900 p-6 rounded-2xl shadow-xl w-full max-w-md border border-zinc-700">
        <h2 className="text-2xl font-semibold mb-4 text-center">📝 Registrieren bei DETECTO</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial="initial"
                animate="animate"
                exit="exit"
                variants={variants}
              >
                <input
                  type="text"
                  name="firstName"
                  placeholder="Vorname"
                  value={formData.firstName}
                  onChange={handleChange}
                  className="bg-zinc-800 text-white px-4 py-2 rounded-md w-full focus:outline-none mb-2"
                  required
                />
                <input
                  type="text"
                  name="lastName"
                  placeholder="Nachname"
                  value={formData.lastName}
                  onChange={handleChange}
                  className="bg-zinc-800 text-white px-4 py-2 rounded-md w-full focus:outline-none"
                  required
                />
                <button type="button" onClick={handleNext} className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 rounded-md w-full mt-4 transition">
                  Weiter
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial="initial"
                animate="animate"
                exit="exit"
                variants={variants}
              >
                <input
                  type="email"
                  name="email"
                  placeholder="E-Mail-Adresse"
                  value={formData.email}
                  onChange={handleChange}
                  className="bg-zinc-800 text-white px-4 py-2 rounded-md w-full focus:outline-none"
                  required
                />
                <button type="button" onClick={handleNext} className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 rounded-md w-full mt-4 transition">
                  Weiter
                </button>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial="initial"
                animate="animate"
                exit="exit"
                variants={variants}
              >
                <input
                  type="password"
                  name="password"
                  placeholder="Passwort (min. 6 Zeichen)"
                  value={formData.password}
                  onChange={handleChange}
                  className="bg-zinc-800 text-white px-4 py-2 rounded-md w-full focus:outline-none"
                  required
                />
                <button type="button" onClick={handleNext} className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 rounded-md w-full mt-4 transition">
                  Weiter
                </button>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial="initial"
                animate="animate"
                exit="exit"
                variants={variants}
              >
                <label className="flex items-start space-x-2 mb-4 text-sm">
                  <input
                    type="checkbox"
                    name="agreedToTerms"
                    checked={formData.agreedToTerms}
                    onChange={handleChange}
                    className="mt-1"
                    required
                  />
                  <span>
                    Ich stimme den{" "}
                    <Link href="/nutzung" className="text-blue-400 underline">
                      Nutzungsbedingungen
                    </Link>
                    , der{" "}
                    <Link href="/datenschutz" className="text-blue-400 underline">
                      Datenschutzerklärung
                    </Link>{" "}
                    und den{" "}
                    <Link href="/cookies" className="text-blue-400 underline">
                      Cookie-Richtlinien
                    </Link>{" "}
                    zu.
                  </span>
                </label>
                <button type="submit" className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 rounded-md w-full transition">
                  Registrieren
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
        <div className="text-sm mt-4 text-center text-gray-400">
          Schon ein Konto?{" "}
          <Link href="/" className="text-blue-400 underline">
            Jetzt einloggen
          </Link>
        </div>
      </div>
    </div>
  );
}