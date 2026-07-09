const SCRIPT_TEMPLATES = [
  {
    filename: 'Leaderstats.server.lua',
    path: 'ServerScriptService/Leaderstats.server.lua',
    type: 'Script',
    purpose: 'Creates the "leaderstats" folder Roblox\'s built-in leaderboard looks for, with a Cash stat. Other server scripts read/write player.leaderstats.Cash.Value directly once this has run.',
    testingChecklist: [
      'Playtest and confirm a "leaderstats" folder with a Cash value appears under your Player in the Explorer.',
      'Confirm Cash shows up in the in-game leaderboard (Roblox\'s built-in player list) automatically.',
      'Test with 2 simulated players and confirm each gets their own independent Cash value.',
    ],
    code: `-- Leaderstats.server.lua
-- Place in: ServerScriptService

local Players = game:GetService("Players")

local function onPlayerAdded(player)
	local leaderstats = Instance.new("Folder")
	leaderstats.Name = "leaderstats"
	leaderstats.Parent = player

	local cash = Instance.new("IntValue")
	cash.Name = "Cash"
	cash.Value = 0
	cash.Parent = leaderstats
end

Players.PlayerAdded:Connect(onPlayerAdded)

for _, player in ipairs(Players:GetPlayers()) do
	if not player:FindFirstChild("leaderstats") then
		onPlayerAdded(player)
	end
end
`,
  },
  {
    filename: 'CollectibleManager.server.lua',
    path: 'ServerScriptService/CollectibleManager.server.lua',
    type: 'Script',
    purpose: 'Watches a "Collectibles" folder in Workspace. Any part inside it awards Cash and destroys itself when touched by a player — server-authoritative so a modified client can\'t fake collecting an item it never touched.',
    testingChecklist: [
      'Create a Collectibles folder in Workspace with a few parts inside it, then playtest and touch one.',
      'Confirm the touched part is destroyed and your Cash increases exactly once, not multiple times.',
      'Add a new collectible part to the folder while playtesting and confirm it\'s picked up automatically (ChildAdded handling).',
      'Test with 2 simulated players touching different collectibles at the same time and confirm each is only awarded to the player who touched it.',
    ],
    code: `-- CollectibleManager.server.lua
-- Place in: ServerScriptService
-- Requires Leaderstats.server.lua to have run first.

local Players = game:GetService("Players")
local Workspace = game:GetService("Workspace")

local COLLECTIBLE_VALUE = 5

local collectiblesFolder = Workspace:FindFirstChild("Collectibles")
if not collectiblesFolder then
	collectiblesFolder = Instance.new("Folder")
	collectiblesFolder.Name = "Collectibles"
	collectiblesFolder.Parent = Workspace
end

local debounces = {}

local function awardCash(player, amount)
	local leaderstats = player:FindFirstChild("leaderstats")
	if not leaderstats then
		return
	end
	local cash = leaderstats:FindFirstChild("Cash")
	if cash then
		cash.Value += amount
	end
end

local function onCollectibleTouched(collectible, otherPart)
	if debounces[collectible] then
		return
	end
	local character = otherPart.Parent
	local player = character and Players:GetPlayerFromCharacter(character)
	if not player then
		return
	end

	debounces[collectible] = true
	awardCash(player, COLLECTIBLE_VALUE)
	collectible:Destroy()
end

local function watchCollectible(collectible)
	if not collectible:IsA("BasePart") then
		return
	end
	collectible.Touched:Connect(function(otherPart)
		onCollectibleTouched(collectible, otherPart)
	end)
end

for _, child in ipairs(collectiblesFolder:GetChildren()) do
	watchCollectible(child)
end

collectiblesFolder.ChildAdded:Connect(watchCollectible)
`,
  },
  {
    filename: 'SellZone.server.lua',
    path: 'ServerScriptService/SellZone.server.lua',
    type: 'Script',
    purpose: 'A tycoon-style sell pad: standing on a part named "SellZone" converts a player\'s PendingSales counter into Cash, rate-limited so standing still doesn\'t sell repeatedly. This is a standalone pattern example — wire your own production system to increment PendingSales.',
    testingChecklist: [
      'Give a test player a PendingSales IntValue with a nonzero value, then touch the SellZone part and confirm Cash increases and PendingSales resets to 0.',
      'Touch the SellZone repeatedly within SELL_COOLDOWN_SECONDS and confirm it only sells once, not once per touch.',
      'Test with 0 PendingSales and confirm touching SellZone does nothing (no error, no Cash change).',
    ],
    code: `-- SellZone.server.lua
-- Place in: ServerScriptService
-- Expects a part named "SellZone" in Workspace, and a "PendingSales"
-- IntValue under each player (created by your production/collection
-- system) that this script converts into Cash.

local Players = game:GetService("Players")
local Workspace = game:GetService("Workspace")

local SELL_COOLDOWN_SECONDS = 2

local sellZone = Workspace:FindFirstChild("SellZone")
if not sellZone then
	warn("SellZone.server.lua: no part named 'SellZone' found in Workspace yet.")
end

local lastSellTime = {}

local function sell(player)
	local pendingSales = player:FindFirstChild("PendingSales")
	local leaderstats = player:FindFirstChild("leaderstats")
	if not pendingSales or not leaderstats then
		return
	end
	local cash = leaderstats:FindFirstChild("Cash")
	if not cash or pendingSales.Value <= 0 then
		return
	end

	cash.Value += pendingSales.Value
	pendingSales.Value = 0
end

local function onTouched(otherPart)
	local character = otherPart.Parent
	local player = character and Players:GetPlayerFromCharacter(character)
	if not player then
		return
	end

	local now = os.clock()
	if lastSellTime[player] and (now - lastSellTime[player]) < SELL_COOLDOWN_SECONDS then
		return
	end
	lastSellTime[player] = now

	sell(player)
end

if sellZone then
	sellZone.Touched:Connect(onTouched)
end

Players.PlayerRemoving:Connect(function(player)
	lastSellTime[player] = nil
end)
`,
  },
  {
    filename: 'CurrencyGui.client.lua',
    path: 'StarterPlayerScripts/CurrencyGui.client.lua',
    type: 'LocalScript',
    purpose: 'Displays the local player\'s Cash in a simple on-screen label that updates live. Purely visual — reads from leaderstats, never writes to it (all currency changes happen server-side).',
    testingChecklist: [
      'Playtest and confirm the Cash label appears on screen immediately, without needing to touch anything first.',
      'Change your Cash value (e.g. via CollectibleManager) and confirm the label updates live.',
      'Confirm this script never errors if leaderstats hasn\'t loaded yet the instant the LocalScript starts.',
    ],
    code: `-- CurrencyGui.client.lua
-- Place in: StarterPlayerScripts (as a LocalScript)

local Players = game:GetService("Players")
local player = Players.LocalPlayer

local screenGui = Instance.new("ScreenGui")
screenGui.Name = "CurrencyGui"
screenGui.ResetOnSpawn = false
screenGui.Parent = player:WaitForChild("PlayerGui")

local label = Instance.new("TextLabel")
label.Name = "CashLabel"
label.Size = UDim2.new(0, 200, 0, 40)
label.Position = UDim2.new(0, 12, 0, 12)
label.BackgroundTransparency = 0.3
label.BackgroundColor3 = Color3.fromRGB(13, 17, 23)
label.TextColor3 = Color3.fromRGB(255, 255, 255)
label.Font = Enum.Font.GothamBold
label.TextScaled = true
label.Text = "Cash: 0"
label.Parent = screenGui

local function updateLabel(cashValue)
	label.Text = "Cash: " .. tostring(cashValue)
end

local function onLeaderstatsAdded(leaderstats)
	local cash = leaderstats:WaitForChild("Cash")
	updateLabel(cash.Value)
	cash.Changed:Connect(updateLabel)
end

local existingLeaderstats = player:FindFirstChild("leaderstats")
if existingLeaderstats then
	onLeaderstatsAdded(existingLeaderstats)
else
	player.ChildAdded:Connect(function(child)
		if child.Name == "leaderstats" then
			onLeaderstatsAdded(child)
		end
	end)
end
`,
  },
  {
    filename: 'CheckpointManager.server.lua',
    path: 'ServerScriptService/CheckpointManager.server.lua',
    type: 'Script',
    purpose: 'Obby checkpoint system: tracks each player\'s furthest checkpoint touched and teleports them there on respawn, instead of always sending them back to the start.',
    testingChecklist: [
      'Create a Checkpoints folder in Workspace with parts named Checkpoint1, Checkpoint2, etc. in order.',
      'Touch each checkpoint in order and confirm no errors appear in the Output window.',
      'Reset your character after reaching checkpoint 2 or later and confirm you respawn there, not at the start.',
      'Touch checkpoints out of order (skip ahead, then touch an earlier one) and confirm your saved checkpoint only ever moves forward.',
    ],
    code: `-- CheckpointManager.server.lua
-- Place in: ServerScriptService
-- Expects a "Checkpoints" folder in Workspace where each child is a
-- checkpoint part, ordered by Name (Checkpoint1, Checkpoint2, ...).

local Players = game:GetService("Players")
local Workspace = game:GetService("Workspace")

local checkpointsFolder = Workspace:WaitForChild("Checkpoints")
local checkpoints = checkpointsFolder:GetChildren()
table.sort(checkpoints, function(a, b)
	return a.Name < b.Name
end)

local playerCheckpoint = {}

local function onTouched(checkpointIndex, otherPart)
	local character = otherPart.Parent
	local player = character and Players:GetPlayerFromCharacter(character)
	if not player then
		return
	end
	local current = playerCheckpoint[player] or 0
	if checkpointIndex > current then
		playerCheckpoint[player] = checkpointIndex
	end
end

for i, checkpoint in ipairs(checkpoints) do
	checkpoint.Touched:Connect(function(otherPart)
		onTouched(i, otherPart)
	end)
end

Players.PlayerAdded:Connect(function(player)
	playerCheckpoint[player] = 0
	player.CharacterAdded:Connect(function(character)
		local savedIndex = playerCheckpoint[player] or 0
		if savedIndex > 0 then
			local checkpoint = checkpoints[savedIndex]
			local humanoidRootPart = character:WaitForChild("HumanoidRootPart")
			humanoidRootPart.CFrame = checkpoint.CFrame + Vector3.new(0, 3, 0)
		end
	end)
end)

Players.PlayerRemoving:Connect(function(player)
	playerCheckpoint[player] = nil
end)
`,
  },
  {
    filename: 'PlotClaim.server.lua',
    path: 'ServerScriptService/PlotClaim.server.lua',
    type: 'Script',
    purpose: 'Tycoon plot claiming: the first player to touch a plot\'s ClaimButton owns that plot, and can\'t claim a second one. Ownership is stored server-side so a client can\'t fake owning a plot.',
    testingChecklist: [
      'Create a Plots folder in Workspace with at least 2 plot Models, each containing a part named ClaimButton.',
      'Touch one plot\'s ClaimButton and confirm an Owner StringValue appears under that plot with your name.',
      'With 2 simulated players, have both try to claim the SAME plot at nearly the same time — confirm only one becomes the owner.',
      'Have the owning player leave the game and confirm the plot\'s Owner value clears.',
    ],
    code: `-- PlotClaim.server.lua
-- Place in: ServerScriptService
-- Expects a "Plots" folder in Workspace where each child is a plot Model
-- containing a part named "ClaimButton".

local Players = game:GetService("Players")
local Workspace = game:GetService("Workspace")

local plotsFolder = Workspace:WaitForChild("Plots")
local plotOwner = {} -- plot model -> player

local function claimPlot(plot, player)
	if plotOwner[plot] then
		return -- already claimed
	end
	for _, owner in pairs(plotOwner) do
		if owner == player then
			return -- this player already owns a different plot
		end
	end
	plotOwner[plot] = player
	local ownerValue = plot:FindFirstChild("Owner")
	if not ownerValue then
		ownerValue = Instance.new("StringValue")
		ownerValue.Name = "Owner"
		ownerValue.Parent = plot
	end
	ownerValue.Value = player.Name
end

for _, plot in ipairs(plotsFolder:GetChildren()) do
	local claimButton = plot:FindFirstChild("ClaimButton")
	if claimButton then
		claimButton.Touched:Connect(function(otherPart)
			local character = otherPart.Parent
			local player = character and Players:GetPlayerFromCharacter(character)
			if player then
				claimPlot(plot, player)
			end
		end)
	end
end

Players.PlayerRemoving:Connect(function(player)
	for plot, owner in pairs(plotOwner) do
		if owner == player then
			plotOwner[plot] = nil
			local ownerValue = plot:FindFirstChild("Owner")
			if ownerValue then
				ownerValue.Value = ""
			end
		end
	end
end)
`,
  },
  {
    filename: 'ShopConfig.lua',
    path: 'ReplicatedStorage/ShopConfig.lua',
    type: 'ModuleScript',
    purpose: 'Shared shop price table, required by ShopPurchaseHandler (server, source of truth for price) and any client shop UI (to display prices) from one place instead of two.',
    testingChecklist: [
      'Require ShopConfig from a server script and print ShopConfig.getPrice("SpeedBoost") — confirm it prints 50.',
      'Confirm requiring this from both a server Script and a client LocalScript works without error.',
      'Add a new item to the Items table and confirm ShopPurchaseHandler picks up the new price without any of its own code changing.',
    ],
    code: `-- ShopConfig.lua
-- Place in: ReplicatedStorage (as a ModuleScript)
-- Shared price table — required by both ShopPurchaseHandler (server, source
-- of truth) and any client shop UI (to display prices). Never trust a
-- client-reported price; always look it up from here on the server.

local ShopConfig = {}

ShopConfig.Items = {
	SpeedBoost = { price = 50, displayName = "Speed Boost" },
	DoubleJump = { price = 100, displayName = "Double Jump" },
	ExtraSlot = { price = 250, displayName = "Extra Inventory Slot" },
}

function ShopConfig.getPrice(itemId)
	local item = ShopConfig.Items[itemId]
	return item and item.price or nil
end

return ShopConfig
`,
  },
  {
    filename: 'ShopPurchaseHandler.server.lua',
    path: 'ServerScriptService/ShopPurchaseHandler.server.lua',
    type: 'Script',
    purpose: 'Handles the PurchaseItem RemoteEvent: looks up the real price from ShopConfig server-side and only deducts Cash and grants the item if the player can actually afford it — never trusts a client-sent price.',
    testingChecklist: [
      'Fire PurchaseItem from a client with a valid item id and confirm Cash decreases by the correct server-side price, not any price the client sends.',
      'Fire PurchaseItem with an item id that doesn\'t exist in ShopConfig and confirm nothing happens (no error, no charge).',
      'Fire PurchaseItem when the player can\'t afford the item and confirm Cash doesn\'t go negative.',
      'Test as 2 simulated players purchasing at the same time and confirm each player\'s own Cash is charged, not the other player\'s.',
    ],
    code: `-- ShopPurchaseHandler.server.lua
-- Place in: ServerScriptService
-- Requires ShopConfig.lua (ReplicatedStorage) and a RemoteEvent named
-- "PurchaseItem" in ReplicatedStorage/RemoteEvents.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ShopConfig = require(ReplicatedStorage:WaitForChild("ShopConfig"))

local remoteEvents = ReplicatedStorage:WaitForChild("RemoteEvents")
local purchaseItem = remoteEvents:WaitForChild("PurchaseItem")

local function onPurchaseItem(player, itemId)
	if typeof(itemId) ~= "string" then
		return
	end
	local price = ShopConfig.getPrice(itemId)
	if not price then
		return -- unknown item id — ignore, don't trust the client's claim
	end

	local leaderstats = player:FindFirstChild("leaderstats")
	local cash = leaderstats and leaderstats:FindFirstChild("Cash")
	if not cash or cash.Value < price then
		return -- can't afford it, regardless of what the client thinks
	end

	cash.Value -= price
	-- Grant the item here — e.g. add it to an inventory Folder/table, or
	-- set a BoolValue under the player. What "granting" means depends on
	-- your game; this script's job is just to validate the purchase safely.
end

purchaseItem.OnServerEvent:Connect(onPurchaseItem)
`,
  },
  {
    filename: 'RoundManager.server.lua',
    path: 'ServerScriptService/RoundManager.server.lua',
    type: 'Script',
    purpose: 'The single source of truth for round state (lobby / active / ended), stored in a replicated StringValue so other scripts and the client can read it without duplicating the state machine.',
    testingChecklist: [
      'Run the place and confirm a RoundState StringValue appears under ReplicatedStorage with value "lobby".',
      'Playtest with 2 simulated players and confirm RoundState changes to "active" automatically after a few seconds.',
      'Confirm RoundState returns to "lobby" after the round length plus the 5 second reset buffer elapses.',
      'Keep 2+ players in the lobby continuously across several rounds and confirm exactly one round runs at a time, never two overlapping.',
    ],
    code: `-- RoundManager.server.lua
-- Place in: ServerScriptService
-- The single source of truth for round state. Other scripts (and the
-- client, since this replicates) should read the RoundState StringValue
-- under ReplicatedStorage rather than tracking their own copy of it.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local ROUND_LENGTH_SECONDS = 60
local MIN_PLAYERS_TO_START = 2

local roundState = ReplicatedStorage:FindFirstChild("RoundState")
if not roundState then
	roundState = Instance.new("StringValue")
	roundState.Name = "RoundState"
	roundState.Value = "lobby"
	roundState.Parent = ReplicatedStorage
end

local function endRound()
	if roundState.Value ~= "active" then
		return
	end
	roundState.Value = "ended"
	task.wait(5)
	roundState.Value = "lobby"
end

local function startRound()
	if roundState.Value ~= "lobby" then
		return -- guard against starting a round twice
	end
	roundState.Value = "active"
	task.delay(ROUND_LENGTH_SECONDS, endRound)
end

task.spawn(function()
	while true do
		task.wait(3)
		if roundState.Value == "lobby" and #Players:GetPlayers() >= MIN_PLAYERS_TO_START then
			startRound()
		end
	end
end)
`,
  },
  {
    filename: 'PetConfig.lua',
    path: 'ReplicatedStorage/PetConfig.lua',
    type: 'ModuleScript',
    purpose: 'Shared pet definitions (name, rarity, hatch weight), required by PetHatchHandler (server, rolls pets) and any client UI that wants to display odds.',
    testingChecklist: [
      'Require PetConfig from a server script and print #PetConfig.Pets — confirm it matches the number of pets you defined.',
      'Confirm the weights reflect the odds you want (they don\'t need to total 100 — PetHatchHandler normalizes by the total).',
      'Add a new pet to the table and confirm PetHatchHandler can roll it with no other code changes.',
    ],
    code: `-- PetConfig.lua
-- Place in: ReplicatedStorage (as a ModuleScript)
-- Shared pet definitions — required by HatchHandler (server, rolls pets)
-- and any client UI that wants to display odds.

local PetConfig = {}

PetConfig.Pets = {
	{ name = "Common Cat", rarity = "Common", weight = 70 },
	{ name = "Rare Fox", rarity = "Rare", weight = 25 },
	{ name = "Legendary Dragon", rarity = "Legendary", weight = 5 },
}

return PetConfig
`,
  },
  {
    filename: 'PetHatchRequest.client.lua',
    path: 'StarterPlayerScripts/PetHatchRequest.client.lua',
    type: 'LocalScript',
    purpose: 'Fires a RequestHatch RemoteEvent when the player touches a "HatchButton" part. Does not decide the outcome — only asks the server to hatch a pet.',
    testingChecklist: [
      'Create a HatchButton part in Workspace and a RequestHatch RemoteEvent under ReplicatedStorage/RemoteEvents.',
      'Touch the HatchButton and confirm the server receives exactly one RequestHatch fire per touch, not several.',
      'Touch it rapidly and confirm the debounce prevents many requests per second.',
      'Confirm another player touching it doesn\'t fire your client\'s request.',
    ],
    code: `-- PetHatchRequest.client.lua
-- Place in: StarterPlayerScripts (as a LocalScript)
-- Fires when the player touches a part named "HatchButton" in Workspace.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local player = Players.LocalPlayer
local requestHatch = ReplicatedStorage:WaitForChild("RemoteEvents"):WaitForChild("RequestHatch")

local hatchButton = Workspace:WaitForChild("HatchButton")
local debounce = false

hatchButton.Touched:Connect(function(otherPart)
	if debounce then
		return
	end
	local character = otherPart.Parent
	if character ~= player.Character then
		return
	end
	debounce = true
	requestHatch:FireServer()
	task.wait(1)
	debounce = false
end)
`,
  },
  {
    filename: 'PetHatchHandler.server.lua',
    path: 'ServerScriptService/PetHatchHandler.server.lua',
    type: 'Script',
    purpose: 'The only place a pet is actually rolled: validates the player can afford it, then picks a pet from PetConfig using server-side randomness. Never trust a client-reported hatch result.',
    testingChecklist: [
      'Fire RequestHatch and confirm Cash decreases by HATCH_COST exactly once per hatch.',
      'Fire RequestHatch rapidly and confirm the cooldown prevents more than one hatch per second.',
      'With PetConfig weights heavily skewed toward one pet, hatch about 20 times and confirm the distribution roughly matches the weights.',
      'Test with 2 simulated players hatching simultaneously and confirm each gets their own independent result.',
    ],
    code: `-- PetHatchHandler.server.lua
-- Place in: ServerScriptService
-- The only place a pet is actually rolled. Requires PetConfig.lua
-- (ReplicatedStorage) and a RequestHatch RemoteEvent.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local PetConfig = require(ReplicatedStorage:WaitForChild("PetConfig"))

local requestHatch = ReplicatedStorage:WaitForChild("RemoteEvents"):WaitForChild("RequestHatch")

local HATCH_COST = 25
local HATCH_COOLDOWN_SECONDS = 1
local lastHatchTime = {}

local function rollPet()
	local totalWeight = 0
	for _, pet in ipairs(PetConfig.Pets) do
		totalWeight += pet.weight
	end
	local roll = math.random() * totalWeight
	local cumulative = 0
	for _, pet in ipairs(PetConfig.Pets) do
		cumulative += pet.weight
		if roll <= cumulative then
			return pet
		end
	end
	return PetConfig.Pets[1]
end

local function onRequestHatch(player)
	local now = os.clock()
	if lastHatchTime[player] and (now - lastHatchTime[player]) < HATCH_COOLDOWN_SECONDS then
		return
	end
	lastHatchTime[player] = now

	local leaderstats = player:FindFirstChild("leaderstats")
	local cash = leaderstats and leaderstats:FindFirstChild("Cash")
	if not cash or cash.Value < HATCH_COST then
		return
	end
	cash.Value -= HATCH_COST

	local pet = rollPet()
	-- Grant the pet here — e.g. add its name to a Pets Folder/table under
	-- the player, or fire a client event so the UI can show what was
	-- hatched. What "granting" means depends on your game.
end

requestHatch.OnServerEvent:Connect(onRequestHatch)
`,
  },
  {
    filename: 'DataManager.server.lua',
    path: 'ServerScriptService/DataManager.server.lua',
    type: 'Script',
    purpose: 'Loads a player\'s saved data on join and saves it on PlayerRemoving. Every DataStore call is wrapped in pcall so a throttled or failed request can\'t crash this script or silently lose data.',
    testingChecklist: [
      'Enable "Studio Access to API Services" in Game Settings > Security before testing.',
      'Playtest, earn some Cash, leave the game, then rejoin and confirm your Cash persisted.',
      'Temporarily break the DataStore call and confirm the script warns instead of crashing the whole server.',
      'Confirm data also saves when the Studio server stops (BindToClose), not just on individual PlayerRemoving.',
    ],
    code: `-- DataManager.server.lua
-- Place in: ServerScriptService
-- Loads player data on join, saves it on PlayerRemoving. Every DataStore
-- call is wrapped in pcall so a throttled or failed request can't crash
-- this script or silently lose data.

local Players = game:GetService("Players")
local DataStoreService = game:GetService("DataStoreService")

local playerDataStore = DataStoreService:GetDataStore("PlayerData_v1")
local playerData = {}

local function defaultData()
	return { cash = 0 }
end

local function loadData(player)
	local success, result = pcall(function()
		return playerDataStore:GetAsync("Player_" .. player.UserId)
	end)
	if success and result then
		playerData[player] = result
	else
		playerData[player] = defaultData()
	end

	local leaderstats = player:FindFirstChild("leaderstats")
	local cash = leaderstats and leaderstats:FindFirstChild("Cash")
	if cash then
		cash.Value = playerData[player].cash
	end
end

local function saveData(player)
	local data = playerData[player]
	if not data then
		return
	end
	local leaderstats = player:FindFirstChild("leaderstats")
	local cash = leaderstats and leaderstats:FindFirstChild("Cash")
	if cash then
		data.cash = cash.Value
	end

	local success, err = pcall(function()
		playerDataStore:SetAsync("Player_" .. player.UserId, data)
	end)
	if not success then
		warn("DataManager: failed to save data for " .. player.Name .. ": " .. tostring(err))
	end
end

Players.PlayerAdded:Connect(loadData)
Players.PlayerRemoving:Connect(saveData)

game:BindToClose(function()
	for _, player in ipairs(Players:GetPlayers()) do
		saveData(player)
	end
end)
`,
  },
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SCRIPT_TEMPLATES };
} else {
  window.BuildCenter = window.BuildCenter || {};
  window.BuildCenter.SCRIPT_TEMPLATES = SCRIPT_TEMPLATES;
}
