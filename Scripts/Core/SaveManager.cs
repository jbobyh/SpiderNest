using Godot;
using SpaceOrLife.World;

namespace SpaceOrLife.Core;

public sealed class SaveManager
{
    public bool HasSave()
    {
        return FileAccess.FileExists(GameConstants.SavePath);
    }

    public void SaveGame(string json)
    {
        using var tmp = FileAccess.Open(GameConstants.SaveTempPath, FileAccess.ModeFlags.Write);
        if (tmp == null)
        {
            GD.PushError($"SaveManager: cannot open temp file {GameConstants.SaveTempPath}");
            return;
        }
        tmp.StoreString(json);

        if (FileAccess.FileExists(GameConstants.SavePath))
        {
            DirAccess.RemoveAbsolute(GameConstants.SavePath);
        }
        DirAccess.RenameAbsolute(GameConstants.SaveTempPath, GameConstants.SavePath);
    }

    public string? LoadSave()
    {
        if (!HasSave()) return null;
        using var f = FileAccess.Open(GameConstants.SavePath, FileAccess.ModeFlags.Read);
        return f?.GetAsText();
    }

    public void DeleteSave()
    {
        DirAccess.RemoveAbsolute(GameConstants.SavePath);
    }

    public bool TrySave(SaveData data)
    {
        var json = SaveSerializer.Serialize(data);
        SaveGame(json);
        return true;
    }

    public SaveData? TryLoad()
    {
        var json = LoadSave();
        if (json == null) return null;
        var data = SaveSerializer.Deserialize(json);
        if (data == null || data.Version != GameConstants.SaveVersion)
        {
            GD.PushError("SaveManager: corrupt save or version mismatch, deleting");
            DeleteSave();
            return null;
        }
        return data;
    }
}
