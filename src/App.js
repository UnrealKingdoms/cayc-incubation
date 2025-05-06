import React, { useCallback, useEffect, useRef, useState } from "react";
import Web3 from "web3";
import gsap from "gsap";
import "./App.css";
import NFTImage from "./NFTImage";

// Minimal ABI for log-based ERC-721 usage
const nftABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: true, name: "tokenId", type: "uint256" },
    ],
    name: "Transfer",
    type: "event",
  },
  {
    constant: true,
    inputs: [{ name: "_tokenId", type: "uint256" }],
    name: "ownerOf",
    outputs: [{ name: "_owner", type: "address" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [{ name: "_tokenId", type: "uint256" }],
    name: "tokenURI",
    outputs: [{ name: "", type: "string" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: false,
    inputs: [
      { name: "_from", type: "address" },
      { name: "_to", type: "address" },
      { name: "_tokenId", type: "uint256" },
    ],
    name: "transferFrom",
    outputs: [],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
];

// Addresses/options for each incubation type
const incubationOptions = {
  rarity: {
    contractAddress: "0xfd39CD1F87a237C628C42c0Efde88AC02654B775",
    heading: "CAYC RARITY INCUBATION CHAMBER",
    buttonLabel: "INCUBATE A RARITY",
  },
  gorilla: {
    // For Gorilla, one contract is used fully and the second only for a tokenID range.
    contractAddress: "0x0cb81977a2147523468ca0b56cba93fa5c5caf67",
    heading: "CAYC GORILLA INCUBATION CHAMBER",
    buttonLabel: "INCUBATE A GORILLA",
  },
  silverback: {
    contractAddress: "0xdb5c9ac6089d6cca205f54ee19bd151e419cac63",
    heading: "SILVERBACK INCUBATION CHAMBER",
    buttonLabel: "INCUBATE A SILVERBACK",
  },
};

// Define small-box image paths for each incubation type using the public folder
const smallBoxImages = {
  rarity: ["/rarity_small1.png", "/rarity_small2.png", "/rarity_small3.png"],
  gorilla: ["/gorilla_small1.png", "/gorilla_small2.png", "/gorilla_small3.png"],
  silverback: [
    "/silverback_small1.png",
    "/silverback_small2.png",
    "/silverback_small3.png",
  ],
};

// Define medium-box image paths for each incubation type using the public folder
const mediumBoxImages = {
  rarity: "/rarity_medium.png",
  gorilla: "/gorilla_medium.png",
  silverback: "/silverback_medium.png",
};

// The staging wallet to which we send each of the 3 NFTs
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
  // pendingRetry holds { succeeded: [...], failed: [...] } for tokens that did not transfer.
  const [pendingRetry, setPendingRetry] = useState(null);

  // Reference for the medium box (if needed)
  const mediumBoxRef = useRef(null);
  const chosenIncubation = selectedOption ? incubationOptions[selectedOption] : null;

  // Enhanced Wallet Integration: Listen for account and chain changes.
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
        } else {
          // No accounts available, gracefully disconnect.
          disconnectWallet();
          alert("Wallet disconnected. Please reconnect.");
        }
      };

      const handleChainChanged = (_chainId) => {
        // Reload page on network change.
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
    setPendingRetry(null);
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
    setPendingRetry(null);
  };

  /**
   * Main NFT fetching function with optimized performance.
   * Metadata requests are parallelized via Promise.all.
   */
  const fetchNFTs = useCallback(
    async (
      providedWeb3 = web3,
      providedAccount = account,
      contractAddress = chosenIncubation?.contractAddress
    ) => {
      if (!providedWeb3 || !providedAccount || !contractAddress) return;
      try {
        setIsLoading(true);

        // Define contracts based on the selected option.
        const contracts = [];
        if (selectedOption === "rarity") {
          contracts.push({
            address: incubationOptions.rarity.contractAddress,
            contract: new providedWeb3.eth.Contract(
              nftABI,
              incubationOptions.rarity.contractAddress
            ),
            filter: (tokenId) => true,
          });
        } else if (selectedOption === "gorilla") {
          contracts.push(
            {
              address: incubationOptions.gorilla.contractAddress,
              contract: new providedWeb3.eth.Contract(
                nftABI,
                incubationOptions.gorilla.contractAddress
              ),
              filter: (tokenId) => true,
            },
            {
              address: "0xdb5c9ac6089d6cca205f54ee19bd151e419cac63",
              contract: new providedWeb3.eth.Contract(
                nftABI,
                "0xdb5c9ac6089d6cca205f54ee19bd151e419cac63"
              ),
              filter: (tokenId) => tokenId >= 1000 && tokenId <= 3000,
            }
          );
        } else if (selectedOption === "silverback") {
          contracts.push({
            address: chosenIncubation.contractAddress,
            contract: new providedWeb3.eth.Contract(
              nftABI,
              chosenIncubation.contractAddress
            ),
            filter: (tokenId) => tokenId >= 3000 && tokenId <= 4000,
          });
        }

        const ownedNFTs = [];

        // Process each contract.
        for (let { address, contract, filter } of contracts) {
          let transferEvents = [];
          try {
            transferEvents = await contract.getPastEvents("Transfer", {
              filter: { to: providedAccount },
              fromBlock: 0,
              toBlock: "latest",
            });
          } catch (error) {
            console.error(`Error fetching Transfer events for contract ${address}:`, error);
            continue;
          }

          // Build a set of token IDs currently owned by the user.
          const userTokens = new Set();
          transferEvents.forEach((event) => {
            const { from, to, tokenId } = event.returnValues;
            if (to.toLowerCase() === providedAccount.toLowerCase()) {
              userTokens.add(tokenId);
            }
            if (from.toLowerCase() === providedAccount.toLowerCase()) {
              userTokens.delete(tokenId);
            }
          });

          // Process tokens in parallel.
          const tokenPromises = Array.from(userTokens)
            .filter((tokenId) => filter(tokenId))
            .map(async (tokenId) => {
              try {
                const owner = await contract.methods.ownerOf(tokenId).call();
                if (owner.toLowerCase() !== providedAccount.toLowerCase()) {
                  return null;
                }
                // Fetch token URI.
                let uri = "";
                try {
                  uri = await contract.methods.tokenURI(tokenId).call();
                  if (uri.startsWith("ipfs://")) {
                    uri = uri.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
                  }
                } catch (err) {
                  console.error(`Error fetching tokenURI for tokenId ${tokenId}:`, err);
                  uri = "";
                }
                // Fetch metadata concurrently.
                let image = "";
                if (uri) {
                  try {
                    const response = await fetch(uri);
                    if (!response.ok) {
                      throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    const metadata = await response.json();
                    if (!metadata || !metadata.image) {
                      throw new Error(`Invalid metadata structure for tokenId ${tokenId}`);
                    }
                    image = metadata.image;
                    if (image.startsWith("ipfs://")) {
                      image = image.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
                    }
                  } catch (err) {
                    console.error(`Error fetching metadata for tokenId ${tokenId}:`, err);
                  }
                }
                return { tokenId, tokenURI: uri, image, contractAddress: address };
              } catch (err) {
                console.error(`Error processing tokenId ${tokenId} in contract ${address}:`, err);
                return null;
              }
            });

          const tokensResults = await Promise.all(tokenPromises);
          tokensResults.forEach((result) => {
            if (result !== null) {
              ownedNFTs.push(result);
            }
          });
        }
        setNfts(ownedNFTs);
      } catch (error) {
        console.error("Error fetching NFTs:", error);
        alert("An error occurred while fetching NFTs. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    },
    [web3, account, chosenIncubation, selectedOption]
  );

  // Fetch NFTs when the option, wallet, or account changes.
  useEffect(() => {
    if (selectedOption && web3 && account && chosenIncubation?.contractAddress) {
      fetchNFTs(web3, account, chosenIncubation.contractAddress);
    }
  }, [selectedOption, web3, account, chosenIncubation, fetchNFTs]);

  // GSAP animation for the boxes (applies to all options)
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

  // Email sending function.
  const sendEmail = async () => {
    const typeLabel =
      selectedOption === "rarity"
        ? "RARITY"
        : selectedOption === "gorilla"
        ? "GORILLA"
        : "SILVERBACK";
    const baseSubject = `An Incubated ${typeLabel} Ape has been made`;
    const body = `The connected wallet address that transferred the NFTs:\n${account}\n\nThe Token IDs of the transferred NFTs:\n${selectedNfts.join(", ")}`;

    let success = false;
    let attempt = 0;
    while (attempt < 3 && !success) {
      const subject = attempt > 0 ? `${baseSubject} - Retry ${attempt}` : baseSubject;
      try {
        const response = await fetch(
          "https://cayc-incubator-email.vercel.app/api/send-email.js",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ to: "admin@cayc.io", subject, body }),
          }
        );
        if (response.ok) {
          success = true;
        } else {
          console.error(`Attempt ${attempt + 1}: Failed to send email: ${response.statusText}`);
          attempt++;
        }
      } catch (error) {
        console.error(`Attempt ${attempt + 1}: Error sending email:`, error);
        attempt++;
      }
    }
    if (!success) {
      setTransferStatusMessage((prevMessage) =>
        (prevMessage ? prevMessage + "\n\n" : "") +
        "Note: The transfers were successful, but the email notification failed to send. Please contact admins."
      );
    }
  };

  // handleFinalIncubation: Transfer NFTs and verify the results.
  const handleFinalIncubation = async () => {
    setShowStepsOverlay(false);
    if (!web3 || !account) return;
    setIsTransferring(true);
    setTransferStatusMessage(null);
    setPendingRetry(null);

    let succeeded = [];
    let failed = [];

    // Main transfer loop.
    for (let tokenId of selectedNfts) {
      try {
        const nftItem = nfts.find((n) => String(n.tokenId) === String(tokenId));
        if (!nftItem) {
          console.error(`NFT with tokenId ${tokenId} not found`);
          failed.push(tokenId);
          continue;
        }
        const nftContract = new web3.eth.Contract(nftABI, nftItem.contractAddress);
        await nftContract.methods
          .transferFrom(account, STAGING_WALLET, tokenId)
          .send({ from: account });
        succeeded.push(tokenId);
      } catch (error) {
        // Verify if transfer succeeded despite error.
        try {
          const nftItem = nfts.find((n) => String(n.tokenId) === String(tokenId));
          if (nftItem) {
            const nftContract = new web3.eth.Contract(nftABI, nftItem.contractAddress);
            const currentOwner = await nftContract.methods.ownerOf(tokenId).call();
            if (currentOwner.toLowerCase() === STAGING_WALLET.toLowerCase()) {
              console.log(`Token ${tokenId} is already transferred (post-error).`);
              succeeded.push(tokenId);
              continue;
            }
          }
          failed.push(tokenId);
        } catch (innerError) {
          console.error(`Failed to verify transfer for tokenId ${tokenId}:`, innerError);
          failed.push(tokenId);
        }
      }
    }

    // If any tokens failed, show a visible retry overlay.
    if (failed.length > 0) {
      setPendingRetry({ succeeded, failed });
    } else {
      setTransferStatusMessage(
        `All selected NFTs transferred successfully!\nTransferred token IDs: ${succeeded.join(", ")}`
      );
      sendEmail();
    }
    setIsTransferring(false);
  };

  // Function to handle retrying failed transfers from the retry overlay.
  const handleRetry = async () => {
    if (!pendingRetry) return;
    let newSucceeded = [...pendingRetry.succeeded];
    let newFailed = [];
    for (let tokenId of pendingRetry.failed) {
      try {
        const nftItem = nfts.find((n) => String(n.tokenId) === String(tokenId));
        if (!nftItem) {
          console.error(`NFT with tokenId ${tokenId} not found on retry`);
          newFailed.push(tokenId);
          continue;
        }
        const nftContract = new web3.eth.Contract(nftABI, nftItem.contractAddress);
        await nftContract.methods
          .transferFrom(account, STAGING_WALLET, tokenId)
          .send({ from: account });
        newSucceeded.push(tokenId);
      } catch (error) {
        try {
          const nftItem = nfts.find((n) => String(n.tokenId) === String(tokenId));
          if (nftItem) {
            const nftContract = new web3.eth.Contract(nftABI, nftItem.contractAddress);
            const currentOwner = await nftContract.methods.ownerOf(tokenId).call();
            if (currentOwner.toLowerCase() === STAGING_WALLET.toLowerCase()) {
              console.log(`Token ${tokenId} is already transferred (retry check).`);
              newSucceeded.push(tokenId);
              continue;
            }
          }
          newFailed.push(tokenId);
        } catch (innerError) {
          console.error(`Retry failed for tokenId ${tokenId} during verification:`, innerError);
          newFailed.push(tokenId);
        }
      }
    }
    if (newFailed.length > 0) {
      // Update pendingRetry to allow further retry attempts.
      setPendingRetry({ succeeded: newSucceeded, failed: newFailed });
    } else {
      setTransferStatusMessage(
        `All transfers succeeded after retry!\nTransferred token IDs: ${newSucceeded.join(", ")}`
      );
      sendEmail();
      setPendingRetry(null);
    }
  };

  // If user cancels the retry, show a summary message.
  const handleCancelRetry = () => {
    if (pendingRetry) {
      setTransferStatusMessage(
        `Transfer Summary:\nSucceeded: ${pendingRetry.succeeded.join(", ")}\nFailed: ${pendingRetry.failed.join(
          ", "
        )}\n\nTransfers failed. Please ensure you have enough ETH for gas fees or contact support for assistance.`
      );
    }
    setPendingRetry(null);
  };

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
                2) An Incubated NFT will be generated within 24hrs and sent to your wallet
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

        {/* Retry overlay for failed transfers */}
        {pendingRetry && (
          <div className="confirmation-overlay">
            <div className="confirmation-box">
              <h3>Transfer Summary</h3>
              <p>
                The following token IDs were successfully transferred: {pendingRetry.succeeded.join(", ")}.
                <br />
                <br />
                The following token IDs failed to transfer: {pendingRetry.failed.join(", ")}.
                <br />
                <br />
                Please ensure you have sufficient ETH to cover gas fees in your wallet.
                <br />
                Would you like to retry transferring these failed NFTs?
              </p>
              <button onClick={handleRetry} style={{ marginRight: "10px", padding: "8px 16px" }}>
                Retry
              </button>
              <button onClick={handleCancelRetry} style={{ padding: "8px 16px" }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {transferStatusMessage && !isTransferring && !pendingRetry && (
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
    </div>
  );
}

export default App;
