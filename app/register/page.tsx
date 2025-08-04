"use client";

import { useState } from "react";
import Link from "next/link";

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    address: "",
    city: "",
    zip: "",
    country: ""
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      alert("Passwörter stimmen nicht überein");
      return;
    }
    // TODO: Registrierung an Backend senden
    console.log("Registrierung:", formData);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black/80 text-white px-4">
      <div className="bg-zinc-900 p-6 rounded-2xl shadow-xl w-full max-w-md border border-zinc-700">
        <h2 className="text-2xl font-semibold mb-4 text-center">📝 Registrieren bei DETECTO</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            name="name"
            placeholder="Name"
            value={formData.name}
            onChange={handleChange}
            className="bg-zinc-800 text-white px-4 py-2 rounded-md focus:outline-none"
            required
          />
          <input
            type="email"
            name="email"
            placeholder="E-Mail-Adresse"
            value={formData.email}
            onChange={handleChange}
            className="bg-zinc-800 text-white px-4 py-2 rounded-md focus:outline-none"
            required
          />
          <input
            type="password"
            name="password"
            placeholder="Passwort"
            value={formData.password}
            onChange={handleChange}
            className="bg-zinc-800 text-white px-4 py-2 rounded-md focus:outline-none"
            required
          />
          <input
            type="password"
            name="confirmPassword"
            placeholder="Passwort bestätigen"
            value={formData.confirmPassword}
            onChange={handleChange}
            className="bg-zinc-800 text-white px-4 py-2 rounded-md focus:outline-none"
            required
          />
          <input
            type="text"
            name="address"
            placeholder="Adresse"
            value={formData.address}
            onChange={handleChange}
            className="bg-zinc-800 text-white px-4 py-2 rounded-md focus:outline-none"
          />
          <input
            type="text"
            name="city"
            placeholder="Stadt"
            value={formData.city}
            onChange={handleChange}
            className="bg-zinc-800 text-white px-4 py-2 rounded-md focus:outline-none"
          />
          <input
            type="text"
            name="zip"
            placeholder="Postleitzahl"
            value={formData.zip}
            onChange={handleChange}
            className="bg-zinc-800 text-white px-4 py-2 rounded-md focus:outline-none"
          />
          <input
            type="text"
            name="country"
            placeholder="Land"
            value={formData.country}
            onChange={handleChange}
            className="bg-zinc-800 text-white px-4 py-2 rounded-md focus:outline-none"
          />
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 rounded-md transition"
          >
            Registrieren
          </button>
        </form>
        <p className="text-sm mt-4 text-center text-gray-400">
          Mit der Registrierung stimmst du unseren{" "}
          <Link href="/nutzung" className="text-blue-400 underline">
            Nutzungsbedingungen
          </Link>{" "}
          und der{" "}
          <Link href="/datenschutz" className="text-blue-400 underline">
            Datenschutzerklärung
          </Link>{" "}
          zu.
        </p>
        <div className="text-sm mt-4 text-center">
          Schon ein Konto?{" "}
          <Link href="/" className="text-blue-400 underline">
            Jetzt einloggen
          </Link>
        </div>
      </div>
    </div>
  );
}