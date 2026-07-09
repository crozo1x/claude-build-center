const SCRIPT_TEMPLATES = [
  {
    filename: 'Leaderstats.server.lua',
    path: 'ServerScriptService/Leaderstats.server.lua',
    purpose: 'Creates the "leaderstats" folder Roblox\'s built-in leaderboard looks for, with a Cash stat. Other server scripts read/write player.leaderstats.Cash.Value directly once this has run.',
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
    purpose: 'Watches a "Collectibles" folder in Workspace. Any part inside it awards Cash and destroys itself when touched by a player — server-authoritative so a modified client can\'t fake collecting an item it never touched.',
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
    purpose: 'A tycoon-style sell pad: standing on a part named "SellZone" converts a player\'s PendingSales counter into Cash, rate-limited so standing still doesn\'t sell repeatedly. This is a standalone pattern example — wire your own production system to increment PendingSales.',
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
    purpose: 'Displays the local player\'s Cash in a simple on-screen label that updates live. Purely visual — reads from leaderstats, never writes to it (all currency changes happen server-side).',
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
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SCRIPT_TEMPLATES };
} else {
  window.BuildCenter = window.BuildCenter || {};
  window.BuildCenter.SCRIPT_TEMPLATES = SCRIPT_TEMPLATES;
}
