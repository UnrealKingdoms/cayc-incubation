import React, { useCallback, useEffect, useRef, useState } from "react";
import Web3 from "web3";
import gsap from "gsap";
import "./App.css";
import NFTImage from "./NFTImage";

const nftABI = [/* ... unchanged ABI ... */];

const incubationOptions = { /* ... unchanged ... */};
const smallBoxImages = { /* ... unchanged ... */};
const mediumBoxImages = { /* ... unchanged ... */};
const STAGING_WALLET = "0x62C72f544e414975CE8b9A8668F97750eb77DbA9";

function App() {
  const [web3, setWeb3] = useState(null);
  const [account, setAccount] = useState(null);
  const [nfts, setNfts] = useState([]);
  const [selectedNfts, setSelectedNfts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null); // "rarity", "gorilla", "silverback"
  const [showStepsOverlay, setShowStepsOverlay] = useState(false);
  const [transferStatusMessage, setTransferStatusMessage] = useState(null);

  const mediumBoxRef = useRef(null);
  const chosenIncubation = selectedOption ? incubationOptions[selectedOption] : null;

  // ***** Make sure this remains TRUE while you're closed *****
  const isClosed = true;

  /* ------------------------------------------
     The rest of your existing logic below
     ------------------------------------------
  */
  
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
        } else {
          disconnectWallet();
          alert("Wallet disconnected. Please reconnect.");
        }
      };

      const handleChainChanged = (_chainId) => {
        window.location.reload();
      };

      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);

      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
          window.ethereum.removeListener("chainChanged", handleChainChanged);
        }
      };
    }
  }, []);

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask or another Web3 wallet provider.");
      return;
    }
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const _web3 = new Web3(window.ethereum);
      setWeb3(_web3);
      const accounts = await _web3.eth.getAccounts();
      setAccount(accounts[0]);
    } catch (error) {
      console.error("Error connecting wallet:", error);
      alert("Failed to connect wallet. Please try again.");
    }
  };

  const disconnectWallet = () => {
    setWeb3(null);
    setAccount(null);
    setNfts([]);
    setSelectedNfts([]);
    setShowStepsOverlay(false);
    setTransferStatusMessage(null);
    setIsTransferring(false);
  };

  const changeWallet = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const _web3 = new Web3(window.ethereum);
      setWeb3(_web3);
      const accounts = await _web3.eth.getAccounts();
      setAccount(accounts[0]);
      if (chosenIncubation) {
        fetchNFTs(_web3, accounts[0], chosenIncubation.contractAddress);
      }
    } catch (error) {
      console.error("Error changing wallet:", error);
      alert("Failed to change wallet. Please try again.");
    }
  };

  const handleGoBack = () => {
    setSelectedOption(null);
    setWeb3(null);
    setAccount(null);
    setNfts([]);
    setSelectedNfts([]);
    setShowStepsOverlay(false);
    setTransferStatusMessage(null);
    setIsTransferring(false);
  };

  const fetchNFTs = useCallback(async (
    providedWeb3 = web3,
    providedAccount = account,
    contractAddress = chosenIncubation?.contractAddress
  ) => {
    // ... your existing NFT fetching code ...
  }, [web3, account, chosenIncubation, selectedOption]);

  useEffect(() => {
    if (selectedOption && web3 && account && chosenIncubation?.contractAddress) {
      fetchNFTs(web3, account, chosenIncubation.contractAddress);
    }
  }, [selectedOption, web3, account, chosenIncubation, fetchNFTs]);

  useEffect(() => {
    if (selectedOption) {
      const tl = gsap.timeline({ repeat: -1 });
      tl.set(".smallBox", { opacity: 0 });
      tl.to({}, { duration: 1 });
      tl.set(".smallBox", { opacity: 1 });
      tl.to(".smallBox", {
        x: 200,
        duration: 1,
        stagger: 0.2,
        ease: "power1.inOut",
      })
        .to(
          ".smallBox",
          {
            opacity: 0,
            duration: 0.5,
            ease: "power1.inOut",
          },
          "+=0.1"
        )
        .set(".smallBox", { x: 0, opacity: 0 })
        .to(".mediumBox", { opacity: 1, duration: 0.1 })
        .to(".mediumBox", { x: 350, duration: 0.8, ease: "power1.inOut" })
        .to(".mediumBox", { opacity: 0, duration: 0.1, ease: "power1.inOut" })
        .set(".mediumBox", { x: 0, opacity: 0 });
    }
  }, [selectedOption]);

  const handleSelectNFT = (tokenId) => {
    if (selectedNfts.includes(tokenId)) {
      setSelectedNfts(selectedNfts.filter((id) => id !== tokenId));
    } else {
      if (selectedNfts.length < 3) {
        setSelectedNfts([...selectedNfts, tokenId]);
      } else {
        alert("You can only select up to 3 NFTs.");
      }
    }
  };

  const handleIncubateClick = () => {
    if (selectedNfts.length !== 3) {
      alert("You must select exactly 3 NFTs before incubating.");
      return;
    }
    setShowStepsOverlay(true);
  };

  const sendEmail = async () => {
    // ... your existing email function ...
  };

  const handleFinalIncubation = async () => {
    // ... your existing final-incubation logic ...
  };

  // The existing code that constructs the UI
  let content;
  if (!selectedOption) {
    content = (
      <div className="menuBox">
        <h2 style={{ color: "white", marginTop: 0 }}>Choose an Incubation Option:</h2>
        <button className="myButton" onClick={() => setSelectedOption("rarity")}>
          INCUBATE A RARITY
        </button>
        <button className="myButton" onClick={() => setSelectedOption("gorilla")}>
          INCUBATE A GORILLA
        </button>
        <button className="myButton" onClick={() => setSelectedOption("silverback")}>
          INCUBATE A SILVERBACK
        </button>
      </div>
    );
  } else {
    content = (
      <div style={{ marginTop: "20px" }}>
        <h1 style={{ color: "white", textAlign: "center" }}>
          {chosenIncubation.heading}
        </h1>
        <div className="boxAnimationContainer">
          <div className="smallBoxesContainer">
            {smallBoxImages[selectedOption].map((src, index) => (
              <div className="smallBox" key={index}>
                <img
                  src={src}
                  alt={`Small box ${index + 1}`}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            ))}
          </div>
          <img className="triangle" src="/incubatortp.png" alt="Incubator" />
          <div className="mediumBox" ref={mediumBoxRef}>
            <img
              src={mediumBoxImages[selectedOption]}
              alt={`Medium Box - ${selectedOption}`}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        </div>
        <button className="myButton" onClick={handleGoBack}>
          Back to Incubation Menu
        </button>
        {!account ? (
          <button className="myButton" onClick={connectWallet}>
            Connect Wallet
          </button>
        ) : (
          <div style={{ color: "white" }}>
            <p>
              <strong>Connected Wallet:</strong> {account}
            </p>
            <button className="myButton" onClick={disconnectWallet}>
              Disconnect Wallet
            </button>
            <button className="myButton" onClick={changeWallet}>
              Change Wallet
            </button>
            <button className="myButton" onClick={() => fetchNFTs()}>
              Refresh NFTs
            </button>
          </div>
        )}
        {isLoading && (
          <p style={{ color: "yellow", fontStyle: "italic", marginTop: "20px" }}>
            Reading NFTs available...
          </p>
        )}
        {!isLoading && nfts.length > 0 ? (
          <table
            style={{
              margin: "20px auto",
              borderCollapse: "collapse",
              color: "white",
            }}
          >
            <thead>
              <tr>
                <th style={{ border: "1px solid #ccc", padding: "8px" }}>Select</th>
                <th style={{ border: "1px solid #ccc", padding: "8px" }}>Token ID</th>
                <th style={{ border: "1px solid #ccc", padding: "8px" }}>Token URI</th>
                <th style={{ border: "1px solid #ccc", padding: "8px" }}>Image</th>
              </tr>
            </thead>
            <tbody>
              {nfts.map((nft) => (
                <tr key={nft.tokenId}>
                  <td style={{ border: "1px solid #ccc", padding: "8px", textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={selectedNfts.includes(nft.tokenId)}
                      onChange={() => handleSelectNFT(nft.tokenId)}
                    />
                  </td>
                  <td style={{ border: "1px solid #ccc", padding: "8px" }}>
                    {String(nft.tokenId)}
                  </td>
                  <td style={{ border: "1px solid #ccc", padding: "8px" }}>
                    {nft.tokenURI || "No URI"}
                  </td>
                  <td style={{ border: "1px solid #ccc", padding: "8px" }}>
                    {nft.image ? (
                      <NFTImage
                        src={nft.image}
                        alt={`Token ${nft.tokenId}`}
                        style={{ width: "100px", height: "auto" }}
                      />
                    ) : (
                      "No Image"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : !isLoading && account ? (
          <p style={{ marginTop: "20px", color: "white" }}>
            No NFTs found for this wallet.
          </p>
        ) : null}
        {!isLoading && nfts.length > 0 && (
          <button className="myButton" onClick={handleIncubateClick}>
            {chosenIncubation.buttonLabel}
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: "blue",
        minHeight: "100vh",
        padding: "20px",
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      <h1
        style={{
          textAlign: "center",
          color: "white",
          fontSize: "3rem",
          marginBottom: "30px",
        }}
      >
        CAYC INCUBATOR
      </h1>
      <div
        style={{
          backgroundColor: "#003366",
          margin: "0 auto",
          minWidth: "390px",
          maxWidth: "1000px",
          borderRadius: "20px",
          padding: "30px",
          textAlign: "center",
        }}
      >
        {content}

        {showStepsOverlay && (
          <div className="confirmation-overlay">
            <div className="confirmation-box">
              <h2>STEPS TO INCUBATE</h2>
              <p>
                1) Your selected 3 NFTs will be moved to a staging wallet
                <br />
                2) An Incubated NFT will be generated within 72hrs and sent to
                your wallet
                <br />
                3) The staging wallet holding the 3 NFTs will be burnt
              </p>
              <p style={{ fontWeight: "bold" }}>
                The process will incur gas fees and is irreversible.
                <br />
                Click OK if you wish to continue or CANCEL to stop now.
              </p>
              <div style={{ marginTop: "10px" }}>
                <button
                  onClick={handleFinalIncubation}
                  style={{ marginRight: "10px", padding: "8px 16px" }}
                >
                  OK
                </button>
                <button onClick={() => setShowStepsOverlay(false)}>CANCEL</button>
              </div>
            </div>
          </div>
        )}

        {isTransferring && (
          <div className="confirmation-overlay">
            <div className="confirmation-box">
              <h3>Transferring your selected NFTs...</h3>
              <p>
                Please confirm <strong>each transaction</strong> in your wallet to
                transfer the tokens to <br />
                <em>{STAGING_WALLET}</em>.
              </p>
            </div>
          </div>
        )}

        {transferStatusMessage && !isTransferring && (
          <div className="confirmation-overlay">
            <div className="confirmation-box">
              <h3>Transfer Status</h3>
              <pre
                style={{
                  backgroundColor: "#f5f5f5",
                  padding: "10px",
                  whiteSpace: "pre-wrap",
                }}
              >
                {transferStatusMessage}
              </pre>
              <button
                style={{ marginTop: "10px", padding: "8px 16px" }}
                onClick={() => setTransferStatusMessage(null)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 
        -------------- FULL-PAGE OVERLAY --------------
        This goes on top if isClosed === true.
        Increase fontSize, color, background as needed.
      */}
      {isClosed && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.95)",
            zIndex: 999999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            color: "#fff",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "5rem", margin: 0 }}>TEMPORARILY CLOSED</h1>
          <p style={{ fontSize: "1.5rem", marginTop: "1rem" }}>
            We will reopen soon!
          </p>
        </div>
      )}
    </div>
  );
}

export default App;
 