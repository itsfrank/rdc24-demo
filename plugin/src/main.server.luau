-- local AssetService = game:GetService("AssetService")
local HttpService = game:GetService("HttpService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local TagSync = require(script.Parent.tagsync)
local ObjUtils = require(script.Parent.obj_utils)

type ImageData = {
    h: number,
    w: number,
    p: { number },
}

type Entry = {
    id: number,
    type: string,
    name: string,
    data: {
        h: number,
        w: number,
        p: { number },
    },
}

print("plugin reloaded")
local tb = plugin:CreateToolbar("Asset Demo")
local btn = tb:CreateButton("foo", "A Button", "rbxassetid://9087232887")

local plugin_enabled = false

type SyncState = {
    sync_folder: Folder,
    images: { [number]: {
        id: number,
        inst: EditableImage,
    } },
    meshes: { [number]: {
        id: number,
        inst: EditableMesh,
    } },
}

function initialize_state(): SyncState
    local sync_folder = ReplicatedStorage:FindFirstChild("SyncFolder")
    if sync_folder ~= nil then
        sync_folder:Destroy()
    end
    sync_folder = Instance.new("Folder", ReplicatedStorage)
    sync_folder.Name = "SyncFolder"
    sync_folder.Archivable = false

    local state: SyncState = {
        sync_folder = sync_folder,
        images = {},
        meshes = {},
    }

    return state
end

local state = initialize_state()

-- will create if not exist
function update_image(id: number, name: string, data: ImageData)
    if state.images[id] == nil then
        local ei = Instance.new("EditableImage", state.sync_folder)
        ei.Name = name
        ei:SetAttribute("sync_id", id)
        ei:SetAttribute("sync_tag", TagSync.make_tag(id))
        state.images[id] = {
            id = id,
            inst = ei,
        }
    end

    local ei = state.images[id].inst

    local size = Vector2.new(data.h, data.w)
    ei:WritePixels(Vector2.zero, size, data.p)

    TagSync.update_id(id, "png")
end

function update_mesh(id: number, name: string, data: any)
    local function set_em_sync_data(em: EditableMesh)
        em.Parent = state.sync_folder
        em.Name = name
        em:SetAttribute("sync_id", id)
        em:SetAttribute("sync_tag", TagSync.make_tag(id))
    end

    if state.meshes[id] == nil then
        local em = Instance.new("EditableMesh")
        set_em_sync_data(em)
        state.meshes[id] = {
            id = id,
            inst = em,
        }
    end

    local new_em = ObjUtils.parse_obj(data)
    if new_em == nil then
        print("error updating mesh")
    end
    set_em_sync_data(new_em)

    -- no way to clear vertext state, so we need to make a new EM and destroy the old one
    state.meshes[id].inst:Destroy()
    state.meshes[id].inst = new_em

    TagSync.update_id(id, "obj")
end

function getAllEntries(): { Entry }
    local res = HttpService:GetAsync("http://localhost:3000/getAll")
    local json = HttpService:JSONDecode(res)
    return json.updates :: { Entry }
end

function getUpdates(): { Entry }
    local res = HttpService:GetAsync("http://localhost:3000/getUpdates")
    local json = HttpService:JSONDecode(res)
    return json.updates :: { Entry }
end

function start_polling()
    local function process_entries(entries: { Entry })
        for _, e in entries do
            if e.type == "png" then
                update_image(e.id, e.name, e.data)
            elseif e.type == "obj" then
                update_mesh(e.id, e.name, e.data)
            end
        end
    end

    coroutine.wrap(function()
        local entries = getAllEntries()
        print(`initializing with {#entries} entries`)
        process_entries(entries)

        print("starting polling")
        while plugin_enabled do
            local updates = getUpdates()
            if #updates > 0 then
                print(`there were {#updates} updates`)
            end

            process_entries(updates)

            wait(0.5)
        end
        print("polling ended")
    end)()
end

btn.Click:Connect(function()
    btn.Enabled = false
    btn.Enabled = true

    if plugin_enabled then
        print("disabling plugin")
        plugin_enabled = false
    else
        for _, c in state.sync_folder:GetChildren() do
            c:Destroy()
        end
        print("enabling plugin")
        state = initialize_state()
        plugin_enabled = true
        start_polling()
    end
end)
