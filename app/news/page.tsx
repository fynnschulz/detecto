import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.8 } },
};

const scaleIn = {
  hidden: { scale: 0.8, opacity: 0 },
  visible: { scale: 1, opacity: 1, transition: { duration: 0.8 } },
};

export default function NewsPage() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900 text-white flex flex-col">
      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center text-center py-24 px-6 bg-gradient-to-br from-purple-900 via-indigo-900 to-black overflow-hidden">
        {/* Glow Elements */}
        <div className="absolute top-10 left-1/4 w-72 h-72 bg-purple-700 rounded-full filter blur-3xl opacity-30 animate-pulse"></div>
        <div className="absolute bottom-10 right-1/4 w-72 h-72 bg-indigo-700 rounded-full filter blur-3xl opacity-30 animate-pulse animation-delay-2000"></div>

        <motion.h1
          className="text-6xl md:text-7xl font-extrabold bg-gradient-to-r from-pink-500 via-yellow-400 to-red-500 bg-clip-text text-transparent drop-shadow-lg relative"
          variants={fadeIn}
          initial="hidden"
          animate="visible"
        >
          Neu bei Detecto
          <span className="absolute inset-0 bg-gradient-to-r from-white via-white to-white opacity-20 animate-shine pointer-events-none"></span>
        </motion.h1>
        <motion.p
          className="mt-6 max-w-xl text-lg md:text-xl text-gray-300"
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.4 }}
        >
          Leak-Check &amp; AttackSim – die neuesten Tools für deine digitale Sicherheit.
        </motion.p>
        <motion.div
          className="mt-10 flex flex-col sm:flex-row gap-6"
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.6 }}
        >
          <Link href="/leak-check" passHref>
            <a className="px-6 py-3 bg-gradient-to-r from-pink-500 to-yellow-400 rounded-full text-black font-semibold shadow-lg hover:brightness-110 transition">
              Leak-Check starten
            </a>
          </Link>
          <Link href="/attacksim" passHref>
            <a className="px-6 py-3 border border-white rounded-full text-white font-semibold hover:bg-white hover:text-black transition">
              AttackSim kennenlernen
            </a>
          </Link>
        </motion.div>
      </section>

      {/* Tools Section */}
      <section className="py-20 px-6 bg-gray-900 flex justify-center">
        <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Leak-Check Card */}
          <motion.div
            className="bg-gradient-to-br from-purple-800 via-indigo-800 to-indigo-900 rounded-xl p-8 shadow-glow hover:shadow-glow-hover transition cursor-pointer flex flex-col items-center text-center"
            variants={scaleIn}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <div className="text-6xl mb-5 bg-gradient-to-r from-pink-500 via-yellow-400 to-red-500 rounded-full w-20 h-20 flex items-center justify-center shadow-glow-icon">
              🔍
            </div>
            <h3 className="text-3xl font-bold mb-3">Leak-Check</h3>
            <p className="text-gray-300 mb-6">
              Finde deine Daten im Netz, bevor es Angreifer tun.
            </p>
            <Link href="/leak-check" passHref>
              <a className="px-5 py-2 bg-pink-500 rounded-full font-semibold text-black hover:brightness-110 transition">
                Leak-Check starten
              </a>
            </Link>
          </motion.div>

          {/* AttackSim Card */}
          <motion.div
            className="bg-gradient-to-br from-purple-800 via-indigo-800 to-indigo-900 rounded-xl p-8 shadow-glow hover:shadow-glow-hover transition cursor-pointer flex flex-col items-center text-center"
            variants={scaleIn}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <div className="text-6xl mb-5 bg-gradient-to-r from-yellow-400 via-red-500 to-pink-500 rounded-full w-20 h-20 flex items-center justify-center shadow-glow-icon">
              ⚡
            </div>
            <h3 className="text-3xl font-bold mb-3">AttackSim</h3>
            <p className="text-gray-300 mb-6">
              Realistische Angriffsszenarien für dein Unternehmen.
            </p>
            <Link href="/attacksim" passHref>
              <a className="px-5 py-2 bg-yellow-400 rounded-full font-semibold text-black hover:brightness-110 transition">
                AttackSim kennenlernen
              </a>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Detecto in Aktion Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-gray-800 via-gray-900 to-black flex flex-col items-center">
        <motion.h2
          className="text-4xl font-extrabold mb-12 text-center"
          variants={fadeIn}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          Detecto in Aktion
        </motion.h2>
        <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Leak-Check Showcase */}
          <motion.div
            className="bg-gray-800 rounded-xl p-6 shadow-glow"
            variants={scaleIn}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <div className="bg-gray-700 rounded-md h-48 flex items-center justify-center text-gray-400 font-semibold mb-6 select-none">
              Screenshot Leak-Check
            </div>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>Treffer sofort sichtbar</li>
              <li>Opt-out-Generator</li>
            </ul>
          </motion.div>

          {/* AttackSim Showcase */}
          <motion.div
            className="bg-gray-800 rounded-xl p-6 shadow-glow"
            variants={scaleIn}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <div className="bg-gray-700 rounded-md h-48 flex items-center justify-center text-gray-400 font-semibold mb-6 select-none">
              Screenshot AttackSim
            </div>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li>Realistische Simulation</li>
              <li>Fix-Anleitungen</li>
            </ul>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 bg-gray-900 text-center text-white text-opacity-50">
        © {currentYear} Detecto
      </footer>

      <style jsx>{`
        .shadow-glow {
          box-shadow: 0 0 20px rgba(139, 92, 246, 0.5);
        }
        .shadow-glow-hover:hover {
          box-shadow: 0 0 30px rgba(139, 92, 246, 0.8);
        }
        .shadow-glow-icon {
          filter: drop-shadow(0 0 6px rgba(255, 192, 203, 0.7));
        }
        .animate-shine {
          animation: shine 3s infinite;
          background-size: 200% 100%;
        }
        @keyframes shine {
          0% {
            background-position: -100% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
      `}</style>
    </div>
  );
}
