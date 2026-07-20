using System.Collections.Generic;
using Godot;

namespace SpaceOrLife.UI;

public partial class ErrorScreen : CanvasLayer
{
	private Label? _label;

	public override void _Ready()
	{
		_label = GetNode<Label>("%ErrorLabel");
	}

	public void ShowErrors(IReadOnlyList<string> errors)
	{
		if (errors.Count == 0)
		{
			Visible = false;
			return;
		}

		Visible = true;
		var msg = string.Join("\n", errors);
		if (_label != null)
			_label.Text = msg;
		GD.PushError($"Catalog validation failed:\n{msg}");
	}
}
