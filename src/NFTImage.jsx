import React, { useEffect, useState } from "react";

const NFTImage = ({ src, alt, style, retryInterval = 5000 }) => {
    const [imageSrc, setImageSrc] = useState(null);
    const [attempt, setAttempt] = useState(0);

    // Function to convert an ipfs:// URI using a given gateway.
    const convertIPFS = (uri, gateway = "https://gateway.pinata.cloud/ipfs/") => {
        if (uri.startsWith("ipfs://")) {
            return uri.replace("ipfs://", gateway);
        }
        return uri;
    };

    // Function to build a proxy URL using your deployed proxy on Vercel.
    const buildProxyUrl = (url) => {
        // Updated proxy endpoint (adjust the path if needed)
        const proxyBase = "https://cayc-incubator-ipfsproxy.vercel.app/api/proxy";
        return `${proxyBase}?url=${encodeURIComponent(url)}`;
    };

    useEffect(() => {
        // Choose the gateway based on the current attempt:
        // Attempt 0: Pinata; Attempt 1 (or higher): Cloudflare.
        const gateway =
            attempt === 0
                ? "https://gateway.pinata.cloud/ipfs/"
                : "https://cloudflare-ipfs.com/ipfs/";
        const originalUrl = convertIPFS(src, gateway);
        const proxiedUrl = buildProxyUrl(originalUrl);

        console.log("Attempt", attempt, "loading image from proxy:", proxiedUrl);
        setImageSrc(proxiedUrl);
    }, [src, attempt]);

    // When the image fails to load, try again after a delay.
    const handleError = () => {
        console.warn("Image failed to load:", imageSrc);
        setTimeout(() => {
            // Increase the attempt count so that we switch gateway on the next try.
            setAttempt((prev) => prev + 1);
        }, retryInterval);
    };

    // Until an imageSrc is determined, show a placeholder.
    if (!imageSrc) {
        return (
            <div
                style={{
                    ...style,
                    backgroundColor: "#eee",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                Loading image...
            </div>
        );
    }

    return <img src={imageSrc} alt={alt} style={style} onError={handleError} />;
};

export default NFTImage;
