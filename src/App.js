import React, { useEffect, useState } from "react";
import Web3 from "web3";
import "./App.css";

// Minimal ABI for log-based ERC-721 usage:
//  - Transfer event
//  - ownerOf
//  - tokenURI
//  - transferFrom
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
    contractAddress: "0x0cB81977a2147523468CA0B56cba93FA5c5CAF67",
    heading: "CAYC GORILLA INCUBATION CHAMBER",
    buttonLabel: "INCUBATE A GORILLA",
  },
  silverback: {
    heading: "SILVERBACK Incubation (Does Nothing)",
    buttonLabel: "",
  },
};

// The staging wallet to which we send each of the 3 NFTs
const STAGING_WALLET = "0x62C72f544e414975CE8b9A8668F97750eb77DbA9";

function App() {
  const [web3, setWeb3] = useState(null);
  const [account, setAccount] = useState(null);
  const [nfts, setNfts] = useState([]);
  const [selectedNfts, setSelectedNfts] = useState([]);

  // Loading states
  const [isLoading, setIsLoading] = useState(false); // For reading NFTs
  const [isTransferring, setIsTransferring] = useState(false); // For transferring NFTs

  // Overlay states
  const [selectedOption, setSelectedOption] = useState(null); // "rarity","gorilla","silverback", or null
  const [showStepsOverlay, setShowStepsOverlay] = useState(false); // "STEPS TO INCUBATE"
  const [transferStatusMessage, setTransferStatusMessage] = useState(null); // success/fail/partial

  // If an option is chosen, read config from `incubationOptions`
  const chosenIncubation = selectedOption
    ? incubationOptions[selectedOption]
    : null;

  // Connect wallet (MetaMask, etc.)
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
      console.error("User denied account access or error occurred:", error);
    }
  };

  // Disconnect: clear local states
  const disconnectWallet = () => {
    setWeb3(null);
    setAccount(null);
    setNfts([]);
    setSelectedNfts([]);
    setShowStepsOverlay(false);
    setTransferStatusMessage(null);
    setIsTransferring(false);
  };

  // Change wallet: re-request accounts
  const changeWallet = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const _web3 = new Web3(window.ethereum);
      setWeb3(_web3);
      const accounts = await _web3.eth.getAccounts();
      setAccount(accounts[0]);
      // Optionally refetch NFTs if user is on a valid option
      if (selectedOption !== "silverback" && chosenIncubation) {
        fetchNFTs(_web3, accounts[0], chosenIncubation.contractAddress);
      }
    } catch (error) {
      console.error("Error changing wallet:", error);
    }
  };

  // Go back to the initial 3-option menu
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

  // Log-based approach to fetch NFTs from Transfer events
  const fetchNFTs = async (
    providedWeb3 = web3,
    providedAccount = account,
    contractAddress = chosenIncubation?.contractAddress
  ) => {
    if (!providedWeb3 || !providedAccount || !contractAddress) return;
    try {
      setIsLoading(true);
      const contract = new providedWeb3.eth.Contract(nftABI, contractAddress);

      console.log("Fetching past Transfer events for contract:", contractAddress);
      const transferEvents = await contract.getPastEvents("Transfer", {
        fromBlock: 0,
        toBlock: "latest",
      });
      console.log("Total Transfer events:", transferEvents.length);

      // Build a set of tokenIds that ended up in the user's wallet
      const userTokens = new Set();

      for (let event of transferEvents) {
        const { from, to, tokenId } = event.returnValues;
        const fromLower = from.toLowerCase();
        const toLower = to.toLowerCase();
        const userAddressLower = providedAccount.toLowerCase();

        if (toLower === userAddressLower) {
          userTokens.add(tokenId);
        }
        if (fromLower === userAddressLower) {
          userTokens.delete(tokenId);
        }
      }

      // Confirm ownership & fetch tokenURI
      const ownedNFTs = [];
      for (let tokenId of userTokens) {
        let owner;
        try {
          owner = await contract.methods.ownerOf(tokenId).call();
        } catch (err) {
          console.warn(`ownerOf failed for tokenId ${tokenId}`, err);
          continue;
        }

        if (owner.toLowerCase() === providedAccount.toLowerCase()) {
          let uri = "";
          try {
            uri = await contract.methods.tokenURI(tokenId).call();
          } catch (err) {
            console.warn(`Could not get tokenURI for ${tokenId}`, err);
          }
          ownedNFTs.push({ tokenId, tokenURI: uri });
        }
      }

      console.log("Final user-owned NFTs:", ownedNFTs);
      setNfts(ownedNFTs);
    } catch (error) {
      console.error("Error fetching NFTs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * After user clicks "OK" in STEPS TO INCUBATE:
   *  1) Hide the steps overlay
   *  2) Transfer each selected NFT to STAGING_WALLET
   *     - If user cancels or a transaction fails, we track partial success
   *  3) Show success or partial/fail message
   */
  const handleFinalIncubation = async () => {
    setShowStepsOverlay(false);

    // We don't do anything if there's no web3 or no chosen contract
    if (!web3 || !account || !chosenIncubation?.contractAddress) {
      return;
    }

    setIsTransferring(true);
    setTransferStatusMessage(null);

    const contract = new web3.eth.Contract(
      nftABI,
      chosenIncubation.contractAddress
    );

    // We'll track which tokens were successfully transferred, and which failed
    const succeeded = [];
    const failed = [];

    for (let tokenId of selectedNfts) {
      try {
        console.log(`Transferring tokenId ${tokenId}...`);
        await contract.methods
          .transferFrom(account, STAGING_WALLET, tokenId)
          .send({ from: account });
        succeeded.push(tokenId);
      } catch (error) {
        console.error(`Transfer for tokenId ${tokenId} failed:`, error);
        failed.push(tokenId);

        // If you want to stop after the first failure:
        // break;
        // If you want to keep going despite one failure:
        // continue;
      }
    }

    setIsTransferring(false);

    // Build a final result message
    if (failed.length === 0) {
      // All 3 transferred
      setTransferStatusMessage("All selected NFTs transferred successfully!");
    } else if (succeeded.length === 0) {
      // None transferred
      setTransferStatusMessage(
        "All selected NFT transfers failed or were cancelled."
      );
    } else {
      // Partial success
      setTransferStatusMessage(
        `Partial success:
         Succeeded: ${succeeded.join(", ")}
         Failed: ${failed.join(", ")}`
      );
    }
  };

  // On mount or changes, if user selected a real contract, fetch their NFTs
  useEffect(() => {
    if (
      selectedOption &&
      selectedOption !== "silverback" &&
      web3 &&
      account &&
      chosenIncubation?.contractAddress
    ) {
      fetchNFTs(web3, account, chosenIncubation.contractAddress);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOption, web3, account]);

  // Handle NFT selection (limit to 3)
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

  // User clicked the main incubate button, show STEPS overlay
  const handleIncubateClick = () => {
    if (selectedNfts.length !== 3) {
      alert("You must select exactly 3 NFTs before incubating.");
      return;
    }
    setShowStepsOverlay(true);
  };

  // Render the 3-option menu if not selected
  if (!selectedOption) {
    return (
      <div style={{ padding: "20px" }}>
        <h2>Choose an Incubation Option:</h2>
        <button onClick={() => setSelectedOption("rarity")}>
          1) INCUBATE A RARITY
        </button>
        <button onClick={() => setSelectedOption("gorilla")} style={{ marginLeft: 10 }}>
          2) INCUBATE A GORILLA
        </button>
        <button onClick={() => setSelectedOption("silverback")} style={{ marginLeft: 10 }}>
          3) INCUBATE A SILVERBACK
        </button>
      </div>
    );
  }

  // If user selected silverback, do nothing
  if (selectedOption === "silverback") {
    return (
      <div style={{ padding: "20px" }}>
        <h2>You have selected SILVERBACK INCUBATION. This does nothing.</h2>
        <div style={{ marginTop: 10 }}>
          <button onClick={handleGoBack}>Back to Incubation Menu</button>
        </div>
      </div>
    );
  }

  // Otherwise, user selected 'rarity' or 'gorilla'
  return (
    <div style={{ padding: "20px" }}>
      <h1>{chosenIncubation.heading}</h1>

      {/* "Go Back" on its own line */}
      <div style={{ marginBottom: 10 }}>
        <button onClick={handleGoBack}>Back to Incubation Menu</button>
      </div>

      {/* Wallet connection UI */}
      {!account ? (
        <button onClick={connectWallet}>Connect Wallet</button>
      ) : (
        <div>
          <p>
            <strong>Connected Wallet:</strong> {account}
          </p>
          <button onClick={disconnectWallet}>Disconnect Wallet</button>
          <button onClick={changeWallet} style={{ marginLeft: "10px" }}>
            Change Wallet
          </button>
          <button onClick={() => fetchNFTs()} style={{ marginLeft: "10px" }}>
            Refresh NFTs
          </button>
        </div>
      )}

      {/* Show loading message if reading NFTs */}
      {isLoading && (
        <p style={{ color: "blue", fontStyle: "italic", marginTop: "20px" }}>
          Reading NFTs available...
        </p>
      )}

      {/* NFT table */}
      {!isLoading && nfts.length > 0 ? (
        <table style={{ marginTop: "20px", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ border: "1px solid #ccc", padding: "8px" }}>Select</th>
              <th style={{ border: "1px solid #ccc", padding: "8px" }}>Token ID</th>
              <th style={{ border: "1px solid #ccc", padding: "8px" }}>Token URI</th>
            </tr>
          </thead>
          <tbody>
            {nfts.map((nft) => (
              <tr key={nft.tokenId}>
                <td style={{ border: "1px solid #ccc", padding: "8px" }}>
                  <input
                    type="checkbox"
                    checked={selectedNfts.includes(nft.tokenId)}
                    onChange={() => handleSelectNFT(nft.tokenId)}
                  />
                </td>
                <td style={{ border: "1px solid #ccc", padding: "8px" }}>
                  {nft.tokenId}
                </td>
                <td style={{ border: "1px solid #ccc", padding: "8px" }}>
                  {nft.tokenURI || "No URI"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : !isLoading && account ? (
        <p style={{ marginTop: "20px" }}>No NFTs found for this wallet.</p>
      ) : null}

      {/* Main Incubate button */}
      {!isLoading && nfts.length > 0 && (
        <button
          style={{
            marginTop: "20px",
            padding: "10px 20px",
            fontSize: "16px",
          }}
          onClick={handleIncubateClick}
        >
          {chosenIncubation.buttonLabel}
        </button>
      )}

      {/* STEPS OVERLAY */}
      {showStepsOverlay && (
        <div className="confirmation-overlay">
          <div className="confirmation-box">
            <h2>STEPS TO INCUBATE</h2>
            <p>
              1) Your selected 3 NFTs will be moved from your wallet to a staging wallet<br />
              2) An Incubated Rarity will be generated and placed in your wallet<br />
              3) The staged wallet holding the 3 NFTs will be burnt
            </p>
            <p style={{ fontWeight: "bold" }}>
              The process will incur gas fees and is irreversible.
              <br />
              Click OK if you wish to continue or CANCEL to stop now.
            </p>
            <div style={{ marginTop: "10px" }}>
              <button
                onClick={handleFinalIncubation}
                style={{
                  marginRight: "10px",
                  padding: "8px 16px",
                }}
              >
                OK
              </button>
              <button onClick={() => setShowStepsOverlay(false)}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer In Process Overlay */}
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

      {/* Transfer Result Overlay (Success, Partial, or Failure) */}
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
  );
}

export default App;
