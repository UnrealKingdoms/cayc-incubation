import React, { useEffect, useState } from "react";

const NFTImage = ({ src, alt, style }) => {
    const [loaded, setLoaded] = useState(false);
    const [retryKey, setRetryKey] = useState(0);

    useEffect(() => {
        let isMounted = true;
        // Create a new image object to preload the image.
        const img = new Image();
        // Append a retry key query parameter to avoid caching issues.
        img.src = `${src}?retry=${retryKey}`;

        img.onload = () => {
            if (isMounted) {
                console.log(`Image loaded successfully: ${img.src}`);
                setLoaded(true);
            }
        };

        img.onerror = () => {
            console.warn(`Failed to load image: ${img.src}. Retrying in 5 seconds.`);
            if (isMounted) {
                // Retry after 5 seconds.
                setTimeout(() => {
                    setRetryKey(prev => prev + 1);
                }, 5000);
            }
        };

        return () => {
            isMounted = false;
        };
    }, [src, retryKey]);

    // Until loaded, display a placeholder (or nothing)
    if (!loaded) {
        return (
            <div style={{
                ...style,
                backgroundColor: "#eee",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
            }}>
                Loading image...
            </div>
        );
    }

    // Once loaded, render the image.
    return <img src={`${src}?retry=${retryKey}`} alt={alt} style={style} />;
};

export default NFTImage;
