import React, { useEffect, useRef, useState } from "react";
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

  // Reference for the medium box (if needed)
  const mediumBoxRef = useRef(null);

  const chosenIncubation = selectedOption ? incubationOptions[selectedOption] : null;

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
      console.error("User denied account access or error:", error);
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

  /**
   * Helper function to fetch all NFTs from a given contractAddress
   * with optional minTokenId / maxTokenId filters.
   */
  const fetchNFTsFromContract = async (
    providedWeb3,
    providedAccount,
    contractAddress,
    minTokenId = 0,
    maxTokenId = Infinity
  ) => {
    const contract = new providedWeb3.eth.Contract(nftABI, contractAddress);
    const transferEvents = await contract.getPastEvents("Transfer", {
      fromBlock: 0,
      toBlock: "latest",
    });

    // A set of tokenIds that ended up in `providedAccount`.
    const userTokens = new Set();
    transferEvents.forEach((event) => {
      const { from, to, tokenId } = event.returnValues;
      const numId = parseInt(tokenId, 10);
      if (numId < minTokenId || numId > maxTokenId) {
        return;
      }
      if (to.toLowerCase() === providedAccount.toLowerCase()) {
        userTokens.add(tokenId);
      }
      if (from.toLowerCase() === providedAccount.toLowerCase()) {
        userTokens.delete(tokenId);
      }
    });

    const ownedNFTs = [];
    for (let tokenId of userTokens) {
      try {
        const owner = await contract.methods.ownerOf(tokenId).call();
        if (owner.toLowerCase() === providedAccount.toLowerCase()) {
          let uri = "";
          try {
            uri = await contract.methods.tokenURI(tokenId).call();
            if (uri.startsWith("ipfs://")) {
              uri = uri.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
            }
          } catch (err) {
            console.warn(`Could not get tokenURI for ${tokenId}`, err);
          }
          let image = "";
          try {
            const response = await fetch(uri);
            const metadata = await response.json();
            image = metadata.image || "";
            if (image.startsWith("ipfs://")) {
              image = image.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
            }
          } catch (err) {
            console.warn(`Could not fetch metadata for ${tokenId}`, err);
          }
          ownedNFTs.push({ tokenId, tokenURI: uri, image });
        }
      } catch (err) {
        console.warn(`ownerOf failed for tokenId ${tokenId}`, err);
      }
    }
    return ownedNFTs;
  };

  /**
   * Main NFT fetching function.
   * Updated to include silverback functionality.
   */
  const fetchNFTs = async (
    providedWeb3 = web3,
    providedAccount = account,
    contractAddress = chosenIncubation?.contractAddress
  ) => {
    if (!providedWeb3 || !providedAccount || !contractAddress) return;
    try {
      setIsLoading(true);
  
      // Define contracts and their conditions based on the selected option
      const contracts = [];
      if (selectedOption === "rarity") {
        contracts.push({
          address: incubationOptions.rarity.contractAddress,
          contract: new providedWeb3.eth.Contract(nftABI, incubationOptions.rarity.contractAddress),
          filter: (tokenId) => true,
        });
      } else if (selectedOption === "gorilla") {
        // Gorilla uses two contracts with different token ID filters.
        contracts.push(
          {
            address: incubationOptions.gorilla.contractAddress,
            contract: new providedWeb3.eth.Contract(nftABI, incubationOptions.gorilla.contractAddress),
            filter: (tokenId) => true,
          },
          {
            address: "0xdb5c9ac6089d6cca205f54ee19bd151e419cac63",
            contract: new providedWeb3.eth.Contract(nftABI, "0xdb5c9ac6089d6cca205f54ee19bd151e419cac63"),
            filter: (tokenId) => tokenId >= 1000 && tokenId <= 2000,
          }
        );
      } else if (selectedOption === "silverback") {
        // For Silverback, only fetch tokens with IDs between 3000 and 4000.
        contracts.push({
          address: chosenIncubation.contractAddress,
          contract: new providedWeb3.eth.Contract(nftABI, chosenIncubation.contractAddress),
          filter: (tokenId) => tokenId >= 3000 && tokenId <= 4000,
        });
      }
  
      const ownedNFTs = [];
      for (let { address, contract, filter } of contracts) {
        const transferEvents = await contract.getPastEvents("Transfer", {
          fromBlock: 0,
          toBlock: "latest",
        });
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
  
        for (let tokenId of userTokens) {
          if (!filter(tokenId)) continue;
          try {
            const owner = await contract.methods.ownerOf(tokenId).call();
            if (owner.toLowerCase() === providedAccount.toLowerCase()) {
              let uri = "";
              try {
                uri = await contract.methods.tokenURI(tokenId).call();
                if (uri.startsWith("ipfs://")) {
                  uri = uri.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
                }
              } catch (err) {
                console.warn(`Could not get tokenURI for ${tokenId}`, err);
              }
              let image = "";
              try {
                const response = await fetch(uri);
                const metadata = await response.json();
                image = metadata.image || "";
                if (image.startsWith("ipfs://")) {
                  image = image.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
                }
              } catch (err) {
                console.warn(`Could not fetch metadata for ${tokenId}`, err);
              }
              ownedNFTs.push({ tokenId, tokenURI: uri, image, contractAddress: address });
            }
          } catch (err) {
            console.warn(`ownerOf failed for tokenId ${tokenId}`, err);
          }
        }
      }
  
      setNfts(ownedNFTs);
    } catch (error) {
      console.error("Error fetching NFTs:", error);
    } finally {
      setIsLoading(false);
    }
  };

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
      // Append the retry number to the subject on retries.
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
      // Append a feedback message that the transfers succeeded but the email failed.
      setTransferStatusMessage((prevMessage) =>
        (prevMessage ? prevMessage + "\n\n" : "") +
        "Note: The transfers were successful, but the email notification failed to send. Please contact admins."
      );
    }
  };

  /**
   * Updated error-handling logic for NFT transfers with owner verification in both loops.
   */
  const handleFinalIncubation = async () => {
    setShowStepsOverlay(false);
    if (!web3 || !account) return;
    setIsTransferring(true);
    setTransferStatusMessage(null);

    let succeeded = [];
    let failed = [];

    // Main transfer loop
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
        // Check if the NFT was already transferred despite the error.
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

    // If some transfers failed, offer a retry.
    if (failed.length > 0) {
      let initialMsg = "";
      if (succeeded.length > 0) {
        initialMsg = `The following token IDs were transferred successfully: ${succeeded.join(", ")}.\n\n`;
      }
      initialMsg += `The following token IDs failed to transfer: ${failed.join(
        ", "
      )}.\n\nPlease ensure you have enough ETH to cover gas fees.\nWould you like to retry transferring these failed NFTs?`;

      const userConfirmed = window.confirm(initialMsg);

      if (userConfirmed) {
        let retryFailed = [];
        for (let tokenId of failed) {
          try {
            const nftItem = nfts.find((n) => String(n.tokenId) === String(tokenId));
            if (!nftItem) {
              console.error(`NFT with tokenId ${tokenId} not found on retry`);
              retryFailed.push(tokenId);
              continue;
            }
            const nftContract = new web3.eth.Contract(nftABI, nftItem.contractAddress);
            await nftContract.methods
              .transferFrom(account, STAGING_WALLET, tokenId)
              .send({ from: account });
            succeeded.push(tokenId);
          } catch (error) {
            // Check again if the transfer actually succeeded.
            try {
              const nftItem = nfts.find((n) => String(n.tokenId) === String(tokenId));
              if (nftItem) {
                const nftContract = new web3.eth.Contract(nftABI, nftItem.contractAddress);
                const currentOwner = await nftContract.methods.ownerOf(tokenId).call();
                if (currentOwner.toLowerCase() === STAGING_WALLET.toLowerCase()) {
                  console.log(`Token ${tokenId} is already transferred (retry check).`);
                  succeeded.push(tokenId);
                  continue;
                }
              }
              retryFailed.push(tokenId);
            } catch (innerError) {
              console.error(`Retry failed for tokenId ${tokenId} during verification:`, innerError);
              retryFailed.push(tokenId);
            }
          }
        }
        if (retryFailed.length > 0) {
          setTransferStatusMessage(
            `Transfer Summary:\nSucceeded: ${succeeded.join(", ")}\nFailed: ${retryFailed.join(
              ", "
            )}\n\nSome transfers still failed after retry. Please contact support for assistance.`
          );
        } else {
          setTransferStatusMessage(
            `All transfers succeeded after retry!\nTransferred token IDs: ${succeeded.join(", ")}`
          );
          sendEmail();
        }
      } else {
        setTransferStatusMessage(
          `Transfer Summary:\nSucceeded: ${succeeded.join(", ")}\nFailed: ${failed.join(
            ", "
          )}\n\nTransfers failed. Please ensure you have enough ETH for gas fees or contact support for assistance.`
        );
      }
    } else {
      setTransferStatusMessage(
        `All selected NFTs transferred successfully!\nTransferred token IDs: ${succeeded.join(", ")}`
      );
      sendEmail();
    }
    setIsTransferring(false);
  };

  // Fetch NFTs when the option, wallet, or account changes.
  useEffect(() => {
    if (selectedOption && web3 && account && chosenIncubation?.contractAddress) {
      fetchNFTs(web3, account, chosenIncubation.contractAddress);
    }
  }, [selectedOption, web3, account]);

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
        ease: "power1.inOut"
      })
        .to(
          ".smallBox",
          {
            opacity: 0,
            duration: 0.5,
            ease: "power1.inOut"
          },
          "+=0.1"
        )
        .set(".smallBox", { x: 0, opacity: 0 })
        .to(".mediumBox", {
          opacity: 1,
          duration: 0.1
        })
        .to(".mediumBox", {
          x: 350,
          duration: 0.8,
          ease: "power1.inOut"
        })
        .to(".mediumBox", {
          opacity: 0,
          duration: 0.1,
          ease: "power1.inOut"
        })
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

  let content;
  if (!selectedOption) {
    content = (
      <div className="menuBox">
        <h2 style={{ color: "white", marginTop: 0 }}>
          Choose an Incubation Option:
        </h2>
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
                <th style={{ border: "1px solid #ccc", padding: "8px" }}>
                  Select
                </th>
                <th style={{ border: "1px solid #ccc", padding: "8px" }}>
                  Token ID
                </th>
                <th style={{ border: "1px solid #ccc", padding: "8px" }}>
                  Token URI
                </th>
                <th style={{ border: "1px solid #ccc", padding: "8px" }}>
                  Image
                </th>
              </tr>
            </thead>
            <tbody>
              {nfts.map((nft) => (
                <tr key={nft.tokenId}>
                  <td
                    style={{
                      border: "1px solid #ccc",
                      padding: "8px",
                      textAlign: "center",
                    }}
                  >
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
                2) An Incubated NFT will be generated within 24hrs and sent to
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
                Please confirm <strong>each transaction</strong> in your wallet
                to transfer the tokens to <br />
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
    </div>
  );
}

export default App;
