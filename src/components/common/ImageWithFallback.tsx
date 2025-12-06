import { useState, useEffect } from 'react';
import clsx from 'clsx';

type ImageWithFallbackProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  fallbackSrc?: string;
  type?: 'point' | 'creature';
};

export const ImageWithFallback = ({
  src,
  alt,
  className,
  fallbackSrc,
  type = 'point',
  ...props
}: ImageWithFallbackProps) => {
  const defaultFallback = type === 'point' ? '/images/no-image-point.png' : '/images/no-image-creature.png';
  const effectiveFallback = fallbackSrc || defaultFallback;

  const [imgSrc, setImgSrc] = useState(src || effectiveFallback);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setImgSrc(src || effectiveFallback);
    setHasError(false);
  }, [src, effectiveFallback]);

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      setImgSrc(effectiveFallback);
    }
  };

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={clsx(className, hasError && "object-contain bg-gray-50")}
      onError={handleError}
      {...props}
    />
  );
};
