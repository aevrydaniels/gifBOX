import React, { useMemo, useState, useEffect } from "react";

// Rarity tiers
const TIERS = [
  { key: "common", label: "Common", weight: 70, color: "#6b7280", value: 1 },
  { key: "rare", label: "Rare", weight: 24, color: "#3b82f6", value: 5 },
  { key: "epic", label: "Epic", weight: 5, color: "#8b5cf6", value: 15 },
  { key: "legendary", label: "Legendary", weight: 1, color: "#f59e0b", value: 100 },
];

// Shop items
const SHOP_ITEMS = [
  { id: 1, name: "Common Boost", description: "+5% Common chance", price: 50, effect: { common: 5 }, type: "boost" },
  { id: 2, name: "Rare Boost", description: "+5% Rare chance", price: 100, effect: { rare: 5 }, type: "boost" },
  { id: 3, name: "Epic Boost", description: "+3% Epic chance", price: 250, effect: { epic: 3 }, type: "boost" },
  { id: 4, name: "Legendary Boost", description: "+1% Legendary chance", price: 500, effect: { legendary: 1 }, type: "boost" },
  { id: 5, name: "Lucky Pull", description: "Guaranteed Rare or better", price: 150, effect: { guaranteed: "rare" }, type: "boost" },
  { id: 6, name: "Super Lucky Pull", description: "Guaranteed Epic or better", price: 300, effect: { guaranteed: "epic" }, type: "boost" },
  { id: 7, name: "Ultra Lucky Pull", description: "Guaranteed Legendary", price: 750, effect: { guaranteed: "legendary" }, type: "boost" },
  { id: 8, name: "Multi-Pull", description: "Pull 3 GIFs at once", price: 200, effect: { multipull: 3 }, type: "multipull" },
  { id: 9, name: "Mega Pull", description: "Pull 5 GIFs at once", price: 400, effect: { multipull: 5 }, type: "multipull" },
  { id: 10, name: "Currency Boost", description: "+25% currency from pulls", price: 300, effect: { currency: 25 }, type: "currency" },
  { id: 11, name: "Super Currency Boost", description: "+50% currency from pulls", price: 600, effect: { currency: 50 }, type: "currency" },
  { id: 12, name: "Reroll", description: "Reroll your last pull", price: 100, effect: { reroll: true }, type: "utility" },
  { id: 13, name: "Tag Mastery", description: "Unlock advanced tag filtering", price: 250, effect: { tagMastery: true }, type: "utility" },
  { id: 14, name: "Collection Expansion", description: "Increase history capacity to 100", price: 350, effect: { capacity: 100 }, type: "utility" },
];

// Tenor API for random GIF fetching
const TENOR_API = {
  name: "GIF",
  randomEndpoint: "https://api.tenor.com/v1/random",
  apiKey: "LIVDSRZULELA", // Public key
  tagParam: "q",
  limit: 50, // Increased limit to get more variety
  contentfilter: "high"
};

// Catalog to track GIFs and their assigned rarities
let gifCatalog = new Map();

function weightedPick(items) {
  const total = items.reduce((s, it) => s + it.weight, 0);
  let r = Math.random() * total;
  for (const it of items) {
    if ((r -= it.weight) <= 0) return it;
  }
  return items[items.length - 1];
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function fetchRandomGifFromAPI(tag = "") {
  try {
    const url = new URL(TENOR_API.randomEndpoint);
    url.searchParams.set("key", TENOR_API.apiKey);
    url.searchParams.set("limit", TENOR_API.limit);
    url.searchParams.set("contentfilter", TENOR_API.contentfilter);
    url.searchParams.set("media_filter", "minimal");
    url.searchParams.set("ar_range", "standard"); // Ensure standard aspect ratio
    
    if (tag) {
      url.searchParams.set(TENOR_API.tagParam, tag);
    }
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      // Filter out GIFs we've already seen
      const newGifs = data.results.filter(result => !gifCatalog.has(result.media[0].gif.url));
      
      if (newGifs.length > 0) {
        const randomGif = pickRandom(newGifs);
        const gifUrl = randomGif.media[0].gif.url;
        const tags = randomGif.tags || [];
        
        return {
          url: gifUrl,
          source: TENOR_API.name,
          tags: tags
        };
      }
      
      // If all GIFs in response are already in catalog, try a different tag
      if (!tag) {
        const fallbackTags = ["funny", "cats", "dogs", "reaction", "meme", "anime", "cartoon", "game"];
        const randomTag = pickRandom(fallbackTags);
        return fetchRandomGifFromAPI(randomTag);
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error fetching from Tenor API:", error);
    return null;
  }
}

// Device detection function
function getDeviceType() {
  const userAgent = navigator.userAgent;
  const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|Windows Phone/i.test(userAgent);
  const isTablet = /iPad|Android|Tablet|PlayBook|Silk/i.test(userAgent);
  
  if (isMobile && !isTablet) {
    return "mobile";
  } else if (isTablet) {
    return "tablet";
  } else {
    return "desktop";
  }
}

export default function App() {
  const [isOpening, setIsOpening] = useState(false);
  const [pull, setPull] = useState(null);
  const [recentPulls, setRecentPulls] = useState([]);
  const [collection, setCollection] = useState([]);
  const [showOdds, setShowOdds] = useState(false);
  const [tagFilter, setTagFilter] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);
  const [currency, setCurrency] = useState(0);
  const [activeBoosts, setActiveBoosts] = useState({});
  const [viewMode, setViewMode] = useState("pull");
  const [selectedGif, setSelectedGif] = useState(null);
  const [shopItems, setShopItems] = useState(SHOP_ITEMS);
  const [isLoading, setIsLoading] = useState(false);
  const [multipullCount, setMultipullCount] = useState(0);
  const [currencyMultiplier, setCurrencyMultiplier] = useState(1);
  const [historyCapacity, setHistoryCapacity] = useState(50);
  const [hasTagMastery, setHasTagMastery] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [deviceType, setDeviceType] = useState("desktop");
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);

  // Detect device type and orientation
  useEffect(() => {
    const handleResize = () => {
      setDeviceType(getDeviceType());
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    
    // Initial detection
    handleResize();
    
    // Listen for resize events
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  // Apply dark mode class to body
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

  // Load saved data from localStorage on component mount
  useEffect(() => {
    const savedData = localStorage.getItem('gifLootboxData');
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        setRecentPulls(parsedData.recentPulls || []);
        setCollection(parsedData.collection || []);
        setCurrency(parsedData.currency || 0);
        setActiveBoosts(parsedData.activeBoosts || {});
        setShopItems(parsedData.shopItems || SHOP_ITEMS);
        setCurrencyMultiplier(parsedData.currencyMultiplier || 1);
        setHistoryCapacity(parsedData.historyCapacity || 50);
        setHasTagMastery(parsedData.hasTagMastery || false);
        setDarkMode(parsedData.darkMode || false);
        
        // Restore gifCatalog
        if (parsedData.gifCatalog) {
          gifCatalog = new Map(parsedData.gifCatalog);
        }
      } catch (e) {
        console.error("Error loading saved data:", e);
      }
    }
  }, []);

  // Save data to localStorage whenever relevant state changes
  useEffect(() => {
    const dataToSave = {
      recentPulls,
      collection,
      currency,
      activeBoosts,
      shopItems,
      currencyMultiplier,
      historyCapacity,
      hasTagMastery,
      darkMode,
      gifCatalog: Array.from(gifCatalog.entries())
    };
    
    localStorage.setItem('gifLootboxData', JSON.stringify(dataToSave));
  }, [recentPulls, collection, currency, activeBoosts, shopItems, currencyMultiplier, historyCapacity, hasTagMastery, darkMode]);

  // Calculate modified odds based on active boosts
  const modifiedOdds = useMemo(() => {
    const totalBaseWeight = TIERS.reduce((s, t) => s + t.weight, 0);
    let modifiedTiers = TIERS.map(tier => ({
      ...tier,
      modifiedWeight: tier.weight + (activeBoosts[tier.key] || 0)
    }));
    
    // If we have a guaranteed pull, override weights
    if (activeBoosts.guaranteed) {
      const guaranteedTier = activeBoosts.guaranteed;
      const tierIndex = TIERS.findIndex(t => t.key === guaranteedTier);
      
      modifiedTiers = modifiedTiers.map((tier, index) => {
        if (index >= tierIndex) {
          return { ...tier, modifiedWeight: 100 / (TIERS.length - tierIndex) };
        }
        return { ...tier, modifiedWeight: 0 };
      });
      
      // Remove the guaranteed boost after calculation
      setTimeout(() => {
        const newBoosts = { ...activeBoosts };
        delete newBoosts.guaranteed;
        setActiveBoosts(newBoosts);
      }, 0);
    }
    
    const totalModifiedWeight = modifiedTiers.reduce((s, t) => s + t.modifiedWeight, 0);
    
    return modifiedTiers.map((t) => ({
      ...t,
      pct: Math.round((t.modifiedWeight / totalModifiedWeight) * 1000) / 10,
    }));
  }, [activeBoosts]);

  // Update leaderboard when collection changes
  useEffect(() => {
    const tierCounts = {};
    TIERS.forEach(tier => {
      tierCounts[tier.key] = 0;
    });
    
    collection.forEach(pull => {
      tierCounts[pull.tierKey] = (tierCounts[pull.tierKey] || 0) + 1;
    });
    
    const newLeaderboard = TIERS.map(tier => ({
      ...tier,
      count: tierCounts[tier.key] || 0
    })).sort((a, b) => b.count - a.count);
    
    setLeaderboard(newLeaderboard);
  }, [collection]);

  // Function to reset all progress
  const resetProgress = () => {
    if (window.confirm("Are you sure you want to reset all progress? This cannot be undone.")) {
      setRecentPulls([]);
      setCollection([]);
      setCurrency(0);
      setActiveBoosts({});
      setShopItems(SHOP_ITEMS);
      setCurrencyMultiplier(1);
      setHistoryCapacity(50);
      setHasTagMastery(false);
      setPull(null);
      gifCatalog.clear();
      localStorage.removeItem('gifLootboxData');
    }
  };

  async function doPull() {
    if (isOpening) return;
    setIsOpening(true);
    setIsLoading(true);

    // Check for multi-pull
    const pullCount = activeBoosts.multipull || 1;
    setMultipullCount(pullCount);
    
    // Process multiple pulls if multi-pull is active
    if (pullCount > 1) {
      // Remove multi-pull after use
      const newBoosts = { ...activeBoosts };
      delete newBoosts.multipull;
      setActiveBoosts(newBoosts);
    }

    const newPulls = [];
    
    for (let i = 0; i < pullCount; i++) {
      // Assign random rarity based on modified weights
      const totalWeight = modifiedOdds.reduce((s, t) => s + t.modifiedWeight, 0);
      let r = Math.random() * totalWeight;
      let tier = modifiedOdds[0];
      
      for (const it of modifiedOdds) {
        if ((r -= it.modifiedWeight) <= 0) {
          tier = it;
          break;
        }
      }
      
      try {
        const gifData = await fetchRandomGifFromAPI(tagFilter);
        
        if (gifData) {
          // Check if this GIF already exists in our catalog with a different rarity
          if (gifCatalog.has(gifData.url)) {
            // Use the existing rarity if already catalogued
            const existingRarity = gifCatalog.get(gifData.url);
            const catalogTier = TIERS.find(t => t.key === existingRarity) || tier;
            tier = catalogTier;
          } else {
            // Add to catalog with this rarity
            gifCatalog.set(gifData.url, tier.key);
          }
          
          const result = {
            url: gifData.url,
            tierKey: tier.key,
            tierLabel: tier.label,
            tierColor: tier.color,
            source: gifData.source,
            tags: gifData.tags,
            value: Math.floor(tier.value * currencyMultiplier),
            time: Date.now(),
            id: Date.now() + i,
            isFavorite: false
          };
          
          newPulls.push(result);
          setCurrency(c => c + Math.floor(tier.value * currencyMultiplier));
        } else {
          alert("Failed to fetch a new GIF. Please try again or use a different tag.");
        }
      } catch (error) {
        console.error("Error in doPull:", error);
      }
    }
    
    if (newPulls.length > 0) {
      setPull(newPulls[0]);
      setRecentPulls(prev => [...newPulls, ...prev].slice(0, historyCapacity));
    }
    
    setIsOpening(false);
    setIsLoading(false);
  }

  function addToCollection(gif) {
    // Check if already in collection
    if (collection.some(item => item.id === gif.id)) return;
    
    const updatedGif = {...gif, isFavorite: true};
    setCollection(prev => [updatedGif, ...prev]);
    
    // Update the recent pull to show it's favorited
    setRecentPulls(prev => 
      prev.map(item => 
        item.id === gif.id ? {...item, isFavorite: true} : item
      )
    );
  }

  function removeFromCollection(gifId) {
    setCollection(prev => prev.filter(item => item.id !== gifId));
    
    // Update the recent pull to show it's not favorited
    setRecentPulls(prev => 
      prev.map(item => 
        item.id === gifId ? {...item, isFavorite: false} : item
      )
    );
  }

  function buyItem(item) {
    if (currency >= item.price) {
      setCurrency(c => c - item.price);
      
      if (item.effect.guaranteed) {
        setActiveBoosts({ ...activeBoosts, guaranteed: item.effect.guaranteed });
      } else if (item.effect.multipull) {
        setActiveBoosts({ ...activeBoosts, multipull: item.effect.multipull });
      } else if (item.effect.currency) {
        setCurrencyMultiplier(m => m + (item.effect.currency / 100));
      } else if (item.effect.capacity) {
        setHistoryCapacity(item.effect.capacity);
      } else if (item.effect.tagMastery) {
        setHasTagMastery(true);
      } else if (item.effect.reroll && recentPulls.length > 0) {
        // Reroll the last pull
        const lastPull = recentPulls[0];
        setCurrency(c => c - lastPull.value); // Remove currency from last pull
        setRecentPulls(h => h.slice(1)); // Remove last pull from history
        alert("Your last pull has been rerolled!");
      } else {
        const newBoosts = { ...activeBoosts };
        Object.keys(item.effect).forEach(tier => {
          newBoosts[tier] = (newBoosts[tier] || 0) + item.effect[tier];
        });
        setActiveBoosts(newBoosts);
      }
      
      // Remove purchased item from shop (except for rerolls and permanent upgrades)
      if (!item.effect.reroll && item.type !== "utility") {
        setShopItems(items => items.filter(i => i.id !== item.id));
      }
      
      alert(`Purchased ${item.name}!`);
    } else {
      alert("Not enough currency!");
    }
  }

  function viewGifDetails(gif) {
    setSelectedGif(gif);
    setViewMode("details");
  }

  function clearRecentPulls() {
    setRecentPulls([]);
    // Don't clear the catalog as we want to maintain rarity consistency
  }

  // Determine layout based on device type
  const isMobile = deviceType === "mobile";
  const isTablet = deviceType === "tablet";
  const isDesktop = deviceType === "desktop";

  // CSS styles for dark mode
  const darkModeStyles = `
    body.dark-mode {
      background-color: #1a202c;
      color: #e2e8f0;
    }
    
    body.dark-mode .card {
      background-color: #2d3748;
      color: #e2e8f0;
    }
    
    body.dark-mode input {
      background-color: #2d3748;
      color: #e2e8f0;
      border-color: #4a5568;
    }
    
    body.dark-mode button:not(.lootbox-btn) {
      background-color: #4a5568;
      color: #e2e8f0;
    }
    
    body.dark-mode .history-item {
      background-color: #2d3748;
      color: #e2e8f0;
    }
  `;

  return (
    <div style={{ 
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: isMobile ? "10px" : "20px",
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      backgroundColor: darkMode ? "#1a202c" : "#f5f5f5",
      color: darkMode ? "#e2e8f0" : "#333",
      transition: "all 0.3s ease",
      fontSize: isMobile ? "14px" : "16px"
    }}>
      <style>{darkModeStyles}</style>
      
      <div style={{ 
        width: "100%", 
        maxWidth: "1200px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center"
      }}>
        {/* Device indicator (for testing) */}
        {false && ( // Set to true to see device detection in action
          <div style={{
            position: "fixed",
            top: "10px",
            right: "10px",
            padding: "5px 10px",
            backgroundColor: "#3b82f6",
            color: "white",
            borderRadius: "5px",
            fontSize: "12px",
            zIndex: 1000
          }}>
            {deviceType} {isPortrait ? "Portrait" : "Landscape"}
          </div>
        )}

        {/* Navigation and Controls */}
        <div style={{ 
          display: "flex", 
          flexDirection: isMobile ? "column" : "row",
          alignItems: "center",
          width: "100%",
          marginBottom: "20px",
          gap: "15px"
        }}>
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5, auto)",
            gap: "10px", 
            justifyContent: "center",
            width: isMobile ? "100%" : "auto"
          }}>
            <button 
              onClick={() => setViewMode("pull")} 
              style={{ 
                padding: isMobile ? "8px 12px" : "10px 16px", 
                backgroundColor: viewMode === "pull" ? "#3b82f6" : (darkMode ? "#4a5568" : "white"), 
                color: viewMode === "pull" ? "white" : (darkMode ? "#e2e8f0" : "#333"),
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: isMobile ? "12px" : "14px"
              }}
            >
              Pull GIFs
            </button>
            <button 
              onClick={() => setViewMode("shop")} 
              style={{ 
                padding: isMobile ? "8px 12px" : "10px 16px", 
                backgroundColor: viewMode === "shop" ? "#3b82f6" : (darkMode ? "#4a5568" : "white"), 
                color: viewMode === "shop" ? "white" : (darkMode ? "#e2e8f0" : "#333"),
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: isMobile ? "12px" : "14px"
              }}
            >
              Shop
            </button>
            <button 
              onClick={() => setViewMode("collection")} 
              style={{ 
                padding: isMobile ? "8px 12px" : "10px 16px", 
                backgroundColor: viewMode === "collection" ? "#3b82f6" : (darkMode ? "#4a5568" : "white"), 
                color: viewMode === "collection" ? "white" : (darkMode ? "#e2e8f0" : "#333"),
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: isMobile ? "12px" : "14px"
              }}
            >
              Collection
            </button>
            <button 
              onClick={resetProgress}
              style={{ 
                padding: isMobile ? "8px 12px" : "10px 16px", 
                backgroundColor: "#ff4757",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: isMobile ? "12px" : "14px"
              }}
            >
              Reset
            </button>
            <button 
              onClick={toggleDarkMode}
              style={{ 
                padding: isMobile ? "8px 12px" : "10px 16px", 
                backgroundColor: darkMode ? "#f59e0b" : "#4a5568",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: isMobile ? "12px" : "14px"
              }}
            >
              {darkMode ? "Light" : "Dark"}
            </button>
          </div>

          {/* Currency Display */}
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            padding: "8px 16px",
            backgroundColor: darkMode ? "#2d3748" : "white",
            borderRadius: "20px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            marginTop: isMobile ? "10px" : "0"
          }}>
            <span style={{ fontWeight: "bold", marginRight: "5px", fontSize: isMobile ? "12px" : "14px" }}>Coins:</span>
            <span style={{ color: "#f59e0b", fontWeight: "bold", fontSize: isMobile ? "12px" : "14px" }}>{currency}</span>
            {currencyMultiplier > 1 && (
              <span style={{ marginLeft: "8px", fontSize: isMobile ? "10px" : "0.8rem", color: "#10b981" }}>
                (+{Math.round((currencyMultiplier - 1) * 100)}%)
              </span>
            )}
          </div>
        </div>

        {viewMode === "pull" && (
          <>
            <header style={{ textAlign: "center", marginBottom: "20px", width: "100%" }}>
              <h1 style={{ fontSize: isMobile ? "1.8rem" : "2.2rem", fontWeight: "bold", marginBottom: "10px" }}>gifBOX</h1>
              <p style={{ fontSize: isMobile ? "0.9rem" : "1.1rem", opacity: 0.7 }}>a gif lootbox game. clicker. idk.</p>
            </header>

            {/* Tag filter input */}
            <div style={{ 
              display: "flex", 
              justifyContent: "center", 
              marginBottom: "20px", 
              width: "100%",
              maxWidth: "600px"
            }}>
              <input
                type="text"
                placeholder={hasTagMastery ? "Enter tags (e.g., cats:funny, space:cool)" : "Enter tags to filter (e.g., cats, space, funny)"}
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                style={{ 
                  padding: isMobile ? "10px 14px" : "12px 16px", 
                  width: "100%", 
                  borderRadius: "8px", 
                  border: "2px solid #ddd",
                  fontSize: isMobile ? "14px" : "1rem",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  backgroundColor: darkMode ? "#2d3748" : "white",
                  color: darkMode ? "#e2e8f0" : "#333"
                }}
              />
            </div>

            {multipullCount > 1 && (
              <div style={{
                padding: "8px 16px",
                backgroundColor: "#8b5cf6",
                color: "white",
                borderRadius: "8px",
                marginBottom: "20px",
                fontWeight: "bold",
                fontSize: isMobile ? "12px" : "14px"
              }}>
                Multi-Pull Active: {multipullCount} GIFs at once!
              </div>
            )}

            <div style={{ 
              display: "flex", 
              flexDirection: "column",
              alignItems: "center",
              width: "100%",
              gap: "20px"
            }}>
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: isMobile || isTablet ? "1fr" : "1fr 1fr",
                gap: "20px",
                width: "100%",
                maxWidth: "1000px"
              }}>
                {/* Lootbox + result */}
                <div style={{ 
                  backgroundColor: darkMode ? "#2d3748" : "white", 
                  borderRadius: "12px", 
                  padding: isMobile ? "15px" : "20px", 
                  boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
                  display: "flex",
                  flexDirection: "column"
                }}>
                  <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: "20px", alignItems: "center" }}>
                    {/* Lootbox */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: isMobile ? "auto" : "140px" }}>
                      <button
                        onClick={doPull}
                        disabled={isOpening}
                        className="lootbox-btn"
                        style={{ 
                          width: isMobile ? "80px" : "100px", 
                          height: isMobile ? "80px" : "100px", 
                          fontSize: isMobile ? "1rem" : "1.2rem",
                          fontWeight: "bold",
                          background: "linear-gradient(145deg, #e6e6e6, #ffffff)",
                          border: "2px solid #ddd",
                          borderRadius: "8px",
                          boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          position: "relative",
                          overflow: "hidden",
                          transition: "all 0.3s ease",
                          color: "#333"
                        }}
                      >
                        {isOpening && (
                          <div style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: "rgba(255,255,255,0.8)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 10
                          }}>
                            <div style={{
                              width: "30px",
                              height: "30px",
                              border: "3px solid rgba(0, 0, 0, 0.1)",
                              borderRadius: "50%",
                              borderTopColor: "#3b82f6",
                              animation: "spin 1s ease-in-out infinite"
                            }}></div>
                          </div>
                        )}
                        <span>{isOpening ? "..." : "Open"}</span>
                      </button>
                      <p style={{ fontSize: isMobile ? "12px" : "0.85rem", marginTop: "12px", opacity: 0.7, textAlign: "center" }}>
                        Odds: {modifiedOdds.map((o) => `${o.label} ${o.pct}%`).join(" · ")}
                      </p>
                      <label style={{ fontSize: isMobile ? "12px" : "0.85rem", marginTop: "10px", display: "flex", alignItems: "center", opacity: 0.7 }}>
                        <input
                          type="checkbox"
                          checked={showOdds}
                          onChange={(e) => setShowOdds(e.target.checked)}
                          style={{ marginRight: "8px" }}
                        />{" "}
                        Show detailed odds
                      </label>
                    </div>

                    {/* Result */}
                    <div style={{ flex: 1, minWidth: 0, width: isMobile ? "100%" : "auto" }}>
                      {pull ? (
                        <div style={{ 
                          border: `3px solid ${pull.tierColor}`,
                          borderRadius: "8px",
                          overflow: "hidden",
                          boxShadow: "0 4px 8px rgba(0,0,0,0.1)"
                        }}>
                          <div style={{ 
                            padding: isMobile ? "10px" : "12px", 
                            fontSize: isMobile ? "12px" : "0.9rem", 
                            fontWeight: "bold",
                            background: pull.tierColor,
                            color: "white",
                            textAlign: "center"
                          }}>
                            {pull.tierLabel} • {pull.source} • +{pull.value} coins
                          </div>
                          <div style={{ 
                            display: "flex", 
                            justifyContent: "center", 
                            alignItems: "center", 
                            minHeight: isMobile ? "150px" : "180px",
                            background: darkMode ? "#4a5568" : "#f9f9f9"
                          }}>
                            <img 
                              src={pull.url} 
                              alt="result gif" 
                              style={{ 
                                maxWidth: "100%", 
                                maxHeight: isMobile ? "150px" : "180px",
                                display: "block" 
                              }} 
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = "https://via.placeholder.com/200x180/eeeeee/999999?text=GIF+Not+Found";
                              }}
                            />
                          </div>
                          {pull.tags.length > 0 && (
                            <div style={{ 
                              padding: isMobile ? "10px" : "12px", 
                              fontSize: isMobile ? "12px" : "0.85rem", 
                              background: darkMode ? "#4a5568" : "#eee", 
                              color: darkMode ? "#e2e8f0" : "#222" 
                            }}>
                              Tags: {pull.tags.join(", ")}
                            </div>
                          )}
                          <div style={{ 
                            padding: "8px", 
                            display: "flex", 
                            justifyContent: "center",
                            background: darkMode ? "#4a5568" : "#f5f5f5"
                          }}>
                            <button 
                              onClick={() => pull.isFavorite ? removeFromCollection(pull.id) : addToCollection(pull)}
                              style={{ 
                                padding: "6px 12px", 
                                backgroundColor: pull.isFavorite ? "#f59e0b" : "#3b82f6",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontWeight: "bold",
                                fontSize: isMobile ? "12px" : "14px",
                                display: "flex",
                                alignItems: "center",
                                gap: "5px"
                              }}
                            >
                              {pull.isFavorite ? "★ Added to Collection" : "★ Add to Collection"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ 
                          minHeight: isMobile ? "150px" : "180px", 
                          display: "flex", 
                          alignItems: "center", 
                          justifyContent: "center",
                          background: darkMode ? "#4a5568" : "#f9f9f9",
                          borderRadius: "8px",
                          border: "2px dashed #ddd"
                        }}>
                          <p style={{ textAlign: "center", opacity: 0.7 }}>Click the box to reveal your first pull ✨</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Leaderboard and Recent Pulls Container */}
                <div style={{ 
                  display: "flex", 
                  flexDirection: "column",
                  gap: "20px"
                }}>
                  {/* Leaderboard */}
                  <div style={{ 
                    backgroundColor: darkMode ? "#2d3748" : "white", 
                    borderRadius: "12px", 
                    padding: isMobile ? "15px" : "20px", 
                    boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
                    flex: 1
                  }}>
                    <h2 style={{ 
                      fontSize: isMobile ? "1.2rem" : "1.4rem", 
                      fontWeight: "bold", 
                      marginBottom: "15px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px"
                    }}>
                      <span>Collection Leaderboard</span>
                    </h2>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {leaderboard.map((tier) => (
                        <div key={tier.key} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{ 
                            width: "20px", 
                            height: "20px", 
                            borderRadius: "4px", 
                            backgroundColor: tier.color 
                          }}></div>
                          <span style={{ flex: 1, fontSize: isMobile ? "12px" : "0.9rem" }}>{tier.label}</span>
                          <span style={{ 
                            fontWeight: "bold", 
                            color: darkMode ? "#e2e8f0" : "#333",
                            fontSize: isMobile ? "12px" : "0.9rem"
                          }}>{tier.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recent Pulls */}
                  <div style={{ 
                    backgroundColor: darkMode ? "#2d3748" : "white", 
                    borderRadius: "12px", 
                    padding: isMobile ? "15px" : "20px", 
                    boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
                    flex: 1
                  }}>
                    <div style={{ 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "center", 
                      marginBottom: "15px" 
                    }}>
                      <h2 style={{ 
                        fontSize: isMobile ? "1.2rem" : "1.4rem", 
                        fontWeight: "bold",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px"
                      }}>
                        <span>Recent Pulls</span>
                        <span style={{ 
                          fontSize: isMobile ? "12px" : "0.8rem", 
                          backgroundColor: "#3b82f6", 
                          color: "white", 
                          padding: "2px 8px", 
                          borderRadius: "10px" 
                        }}>
                          {recentPulls.length}/{historyCapacity}
                        </span>
                      </h2>
                      {recentPulls.length > 0 && (
                        <button 
                          onClick={clearRecentPulls}
                          style={{ 
                            padding: "4px 8px", 
                            backgroundColor: "#ff4757", 
                            color: "white", 
                            border: "none", 
                            borderRadius: "4px", 
                            cursor: "pointer",
                            fontSize: isMobile ? "12px" : "0.8rem"
                          }}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <div style={{ 
                      maxHeight: isMobile ? "150px" : "200px", 
                      overflowY: "auto",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px"
                    }}>
                      {recentPulls.length > 0 ? (
                        recentPulls.map((pull) => (
                          <div 
                            key={pull.id} 
                            className="history-item"
                            style={{ 
                              padding: "8px 12px", 
                              borderRadius: "6px", 
                              display: "flex", 
                              alignItems: "center",
                              gap: "8px",
                              cursor: "pointer",
                              transition: "background-color 0.2s",
                              backgroundColor: darkMode ? "#4a5568" : "#f5f5f5"
                            }}
                            onClick={() => viewGifDetails(pull)}
                            onMouseEnter={(e) => {
                              e.target.style.backgroundColor = darkMode ? "#4a5568" : "#e9e9e9";
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.backgroundColor = darkMode ? "#4a5568" : "#f5f5f5";
                            }}
                          >
                            <div style={{ 
                              width: "12px", 
                              height: "12px", 
                              borderRadius: "2px", 
                              backgroundColor: pull.tierColor 
                            }}></div>
                            <span style={{ 
                              flex: 1, 
                              fontSize: isMobile ? "12px" : "0.85rem",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis"
                            }}>
                              {pull.tierLabel}
                            </span>
                            {!pull.isFavorite && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addToCollection(pull);
                                }}
                                style={{ 
                                  background: "none", 
                                  border: "none", 
                                  cursor: "pointer",
                                  fontSize: isMobile ? "14px" : "16px",
                                  color: "#f59e0b"
                                }}
                                title="Add to Collection"
                              >
                                ☆
                              </button>
                            )}
                            {pull.isFavorite && (
                              <span style={{ color: "#f59e0b" }} title="In Collection">★</span>
                            )}
                          </div>
                        ))
                      ) : (
                        <p style={{ textAlign: "center", opacity: 0.7, fontSize: isMobile ? "12px" : "0.9rem" }}>No pulls yet</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Detailed odds */}
              {showOdds && (
                <div style={{ 
                  backgroundColor: darkMode ? "#2d3748" : "white", 
                  borderRadius: "12px", 
                  padding: isMobile ? "15px" : "20px", 
                  boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
                  width: "100%",
                  maxWidth: "1000px"
                }}>
                  <h2 style={{ 
                    fontSize: isMobile ? "1.2rem" : "1.4rem", 
                    fontWeight: "bold", 
                    marginBottom: "15px" 
                  }}>
                    Detailed Odds
                  </h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {modifiedOdds.map((tier) => (
                      <div key={tier.key} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ 
                          width: "20px", 
                          height: "20px", 
                          borderRadius: "4px", 
                          backgroundColor: tier.color 
                        }}></div>
                        <span style={{ flex: 1, fontSize: isMobile ? "12px" : "0.9rem" }}>{tier.label}</span>
                        <span style={{ 
                          fontWeight: "bold", 
                          color: darkMode ? "#e2e8f0" : "#333",
                          fontSize: isMobile ? "12px" : "0.9rem"
                        }}>{tier.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {viewMode === "shop" && (
          <div style={{ 
            width: "100%", 
            maxWidth: "1000px",
            backgroundColor: darkMode ? "#2d3748" : "white", 
            borderRadius: "12px", 
            padding: isMobile ? "15px" : "20px", 
            boxShadow: "0 4px 8px rgba(0,0,0,0.1)"
          }}>
            <h2 style={{ 
              fontSize: isMobile ? "1.5rem" : "1.8rem", 
              fontWeight: "bold", 
              marginBottom: "20px",
              textAlign: "center"
            }}>
              Shop
            </h2>
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(250px, 1fr))",
              gap: "15px" 
            }}>
              {shopItems.map((item) => (
                <div 
                  key={item.id} 
                  style={{ 
                    padding: "15px", 
                    borderRadius: "8px", 
                    border: "2px solid #ddd",
                    backgroundColor: darkMode ? "#4a5568" : "#f9f9f9"
                  }}
                >
                  <h3 style={{ 
                    fontSize: isMobile ? "1rem" : "1.1rem", 
                    fontWeight: "bold", 
                    marginBottom: "8px" 
                  }}>
                    {item.name}
                  </h3>
                  <p style={{ 
                    fontSize: isMobile ? "0.8rem" : "0.9rem", 
                    marginBottom: "12px", 
                    opacity: 0.8 
                  }}>
                    {item.description}
                  </p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ 
                      fontWeight: "bold", 
                      color: "#f59e0b",
                      fontSize: isMobile ? "0.9rem" : "1rem"
                    }}>
                      {item.price} coins
                    </span>
                    <button 
                      onClick={() => buyItem(item)}
                      disabled={currency < item.price}
                      style={{ 
                        padding: "6px 12px", 
                        backgroundColor: currency >= item.price ? "#10b981" : "#9ca3af",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: currency >= item.price ? "pointer" : "not-allowed",
                        fontWeight: "bold",
                        fontSize: isMobile ? "12px" : "14px"
                      }}
                    >
                      Buy
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {viewMode === "collection" && (
          <div style={{ 
            width: "100%", 
            maxWidth: "1000px",
            backgroundColor: darkMode ? "#2d3748" : "white", 
            borderRadius: "12px", 
            padding: isMobile ? "15px" : "20px", 
            boxShadow: "0 4px 8px rgba(0,0,0,0.1)"
          }}>
            <h2 style={{ 
              fontSize: isMobile ? "1.5rem" : "1.8rem", 
              fontWeight: "bold", 
              marginBottom: "20px",
              textAlign: "center"
            }}>
              Your Collection
            </h2>
            {collection.length > 0 ? (
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(250px, 1fr))",
                gap: "15px" 
              }}>
                {collection.map((gif) => (
                  <div 
                    key={gif.id} 
                    style={{ 
                      border: `3px solid ${gif.tierColor}`,
                      borderRadius: "8px",
                      overflow: "hidden",
                      boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
                      cursor: "pointer"
                    }}
                    onClick={() => viewGifDetails(gif)}
                  >
                    <div style={{ 
                      padding: isMobile ? "8px" : "10px", 
                      fontSize: isMobile ? "12px" : "0.9rem", 
                      fontWeight: "bold",
                      background: gif.tierColor,
                      color: "white",
                      textAlign: "center"
                    }}>
                      {gif.tierLabel}
                    </div>
                    <div style={{ 
                      display: "flex", 
                      justifyContent: "center", 
                      alignItems: "center", 
                      minHeight: "150px",
                      background: darkMode ? "#4a5568" : "#f9f9f9"
                    }}>
                      <img 
                        src={gif.url} 
                        alt="collection gif" 
                        style={{ 
                          maxWidth: "100%", 
                          maxHeight: "150px",
                          display: "block" 
                        }} 
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = "https://via.placeholder.com/200x150/eeeeee/999999?text=GIF+Not+Found";
                        }}
                      />
                    </div>
                    <div style={{ 
                      padding: "8px", 
                      display: "flex", 
                      justifyContent: "center",
                      background: darkMode ? "#4a5568" : "#f5f5f5"
                    }}>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromCollection(gif.id);
                        }}
                        style={{ 
                          padding: "6px 12px", 
                          backgroundColor: "#ff4757",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontWeight: "bold",
                          fontSize: isMobile ? "12px" : "14px"
                        }}
                      >
                        Remove from Collection
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ textAlign: "center", opacity: 0.7 }}>Your collection is empty. Add GIFs to your collection by clicking the star icon next to recent pulls.</p>
            )}
          </div>
        )}

        {viewMode === "details" && selectedGif && (
          <div style={{ 
            width: "100%", 
            maxWidth: "600px",
            backgroundColor: darkMode ? "#2d3748" : "white", 
            borderRadius: "12px", 
            padding: isMobile ? "15px" : "20px", 
            boxShadow: "0 4px 8px rgba(0,0,0,0.1)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ 
                fontSize: isMobile ? "1.5rem" : "1.8rem", 
                fontWeight: "bold" 
              }}>
                GIF Details
              </h2>
              <button 
                onClick={() => setViewMode("pull")}
                style={{ 
                  padding: "8px 12px", 
                  backgroundColor: "#3b82f6", 
                  color: "white", 
                  border: "none", 
                  borderRadius: "4px", 
                  cursor: "pointer",
                  fontSize: isMobile ? "12px" : "14px"
                }}
              >
                Back
              </button>
            </div>
            <div style={{ 
              border: `3px solid ${selectedGif.tierColor}`,
              borderRadius: "8px",
              overflow: "hidden",
              boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
              marginBottom: "20px"
            }}>
              <div style={{ 
                padding: isMobile ? "10px" : "12px", 
                fontSize: isMobile ? "12px" : "0.9rem", 
                fontWeight: "bold",
                background: selectedGif.tierColor,
                color: "white",
                textAlign: "center"
              }}>
                {selectedGif.tierLabel} • {selectedGif.source} • +{selectedGif.value} coins
              </div>
              <div style={{ 
                display: "flex", 
                justifyContent: "center", 
                alignItems: "center", 
                minHeight: "200px",
                background: darkMode ? "#4a5568" : "#f9f9f9"
              }}>
                <img 
                  src={selectedGif.url} 
                  alt="detailed gif" 
                  style={{ 
                    maxWidth: "100%", 
                    maxHeight: "300px",
                    display: "block" 
                  }} 
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "https://via.placeholder.com/300x200/eeeeee/999999?text=GIF+Not+Found";
                  }}
                />
              </div>
              {selectedGif.tags.length > 0 && (
                <div style={{ 
                  padding: isMobile ? "10px" : "12px", 
                  fontSize: isMobile ? "12px" : "0.85rem", 
                  background: darkMode ? "#4a5568" : "#eee", 
                  color: darkMode ? "#e2e8f0" : "#222" 
                }}>
                  Tags: {selectedGif.tags.join(", ")}
                </div>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
              {selectedGif.isFavorite ? (
                <button 
                  onClick={() => removeFromCollection(selectedGif.id)}
                  style={{ 
                    padding: "10px 16px", 
                    backgroundColor: "#ff4757",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "bold",
                    fontSize: isMobile ? "12px" : "14px"
                  }}
                >
                  Remove from Collection
                </button>
              ) : (
                <button 
                  onClick={() => addToCollection(selectedGif)}
                  style={{ 
                    padding: "10px 16px", 
                    backgroundColor: "#3b82f6",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "bold",
                    fontSize: isMobile ? "12px" : "14px"
                  }}
                >
                  Add to Collection
                </button>
              )}
              <a 
                href={selectedGif.url} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ 
                  padding: "10px 16px", 
                  backgroundColor: "#10b981",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: "bold",
                  textDecoration: "none",
                  fontSize: isMobile ? "12px" : "14px"
                }}
              >
                Open Original
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Animation keyframes */}
      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}