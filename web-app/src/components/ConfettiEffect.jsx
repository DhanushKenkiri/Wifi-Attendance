import React, { useEffect, useState } from 'react';
import Confetti from 'react-confetti';

const ConfettiEffect = ({ recycle = false, numberOfPieces = 400, tweenDuration = 6000 }) => {
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <Confetti
      width={dimensions.width}
      height={dimensions.height}
      recycle={recycle}
      numberOfPieces={numberOfPieces}
      tweenDuration={tweenDuration}
      gravity={0.15}
    />
  );
};

export default ConfettiEffect;
