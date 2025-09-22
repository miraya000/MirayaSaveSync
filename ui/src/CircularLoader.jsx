import { motion } from "framer-motion";
import "./CircularLoader.css";

const CircularLoader = ({ text = "LOADING • LOADING • LOADING • " }) => {
  const letters = Array.from(text);

  return (
    <div className="loader-container">
      <motion.div
        className="circular-loader"
        animate={{ rotate: 360 }}
        transition={{
          ease: "linear",
          duration: 10,
          repeat: Infinity,
        }}
      >
        {letters.map((letter, i) => {
          const rotationDeg = (360 / letters.length) * i;
          return (
            <span key={i} style={{ transform: `rotate(${rotationDeg}deg) translateY(-80px)` }}>
              {letter === " " ? "\u00A0" : letter}
            </span>
          );
        })}
      </motion.div>
      <div className="loader-label">Loading Game Data...</div>
    </div>
  );
};

export default CircularLoader;