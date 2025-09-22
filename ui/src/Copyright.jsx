import React from 'react';
import './Copyright.css';

const Copyright = () => {
  const paypalLink = "https://www.paypal.com/paypalme/rizqiismanda"; 

  return (
    <a 
      href={paypalLink} 
      target="_blank" 
      rel="noopener noreferrer" 
      className="copyright-float"
      title="Support the developer"
    >
      Created by levanza1358
    </a>
  );
};

export default Copyright;