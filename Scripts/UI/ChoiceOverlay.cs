using System.Collections.Generic;
using Godot;
using SpaceOrLife.Core.Catalogs;
using SpaceOrLife.Domain;

namespace SpaceOrLife.UI;

public partial class ChoiceOverlay : CanvasLayer
{
	[Signal] public delegate void ChoiceSelectedEventHandler(string choiceId);

	private Panel? _bg;
	private HBoxContainer? _cardRow;
	private Label? _titleLabel;
	private readonly List<string> _currentChoiceIds = new();
	private bool _active;

	private static readonly Color PanelBg = new(0.05f, 0.04f, 0.08f, 0.7f);
	private static readonly Color CardBg = new(0.1f, 0.08f, 0.15f, 0.95f);

	public bool IsActive => _active;

	public override void _Ready()
	{
		Visible = false;
		BuildLayout();
	}

	private void BuildLayout()
	{
		_bg = new Panel();
		_bg.SetAnchorsPreset(Control.LayoutPreset.FullRect);
		var bgStyle = new StyleBoxFlat { BgColor = PanelBg };
		_bg.AddThemeStyleboxOverride("panel", bgStyle);
		AddChild(_bg);

		var centerContainer = new CenterContainer();
		centerContainer.SetAnchorsPreset(Control.LayoutPreset.FullRect);
		_bg.AddChild(centerContainer);

		var vbox = new VBoxContainer();
		vbox.CustomMinimumSize = new Vector2(600, 300);
		centerContainer.AddChild(vbox);

		_titleLabel = new Label { Text = "Choose Upgrade" };
		_titleLabel.HorizontalAlignment = HorizontalAlignment.Center;
		_titleLabel.AddThemeFontSizeOverride("font_size", 20);
		vbox.AddChild(_titleLabel);

		_cardRow = new HBoxContainer();
		_cardRow.Alignment = BoxContainer.AlignmentMode.Center;
		_cardRow.CustomMinimumSize = new Vector2(600, 220);
		vbox.AddChild(_cardRow);

		var hintLabel = new Label { Text = "Click a card or press 1/2/3  |  ESC to skip" };
		hintLabel.HorizontalAlignment = HorizontalAlignment.Center;
		hintLabel.AddThemeFontSizeOverride("font_size", 11);
		hintLabel.AddThemeColorOverride("font_color", new Color(0.6f, 0.6f, 0.6f));
		vbox.AddChild(hintLabel);
	}

	public void ShowChoices(ChoiceType type, List<string> choiceIds, UpgradeCatalog? upgradeCatalog, RoomBonusCatalog? roomBonusCatalog)
	{
		_currentChoiceIds.Clear();
		_currentChoiceIds.AddRange(choiceIds);

		if (_titleLabel != null)
		{
			_titleLabel.Text = type switch
			{
				ChoiceType.Upgrade => "Choose Upgrade",
				ChoiceType.Spatial => "Choose Spatial Upgrade",
				ChoiceType.Cursed => "Choose Cursed Upgrade",
				ChoiceType.RoomBonus => "Choose Room Bonus",
				_ => "Choose"
			};
		}

		if (_cardRow != null)
		{
			foreach (var child in _cardRow.GetChildren())
				child.QueueFree();

			for (int i = 0; i < choiceIds.Count; i++)
			{
				var id = choiceIds[i];
				string label = id;
				string desc = "";
				Color color = Colors.White;

				if (type == ChoiceType.RoomBonus)
				{
					var def = roomBonusCatalog?.GetById(id);
					if (def != null)
					{
						label = def.Label;
						desc = def.Description;
						color = def.Color;
					}
				}
				else
				{
					var def = upgradeCatalog?.GetById(id);
					if (def != null)
					{
						label = def.Label;
						desc = def.Description;
						color = def.Color;
					}
				}

				var card = CreateCard(i + 1, label, desc, color);
				_cardRow.AddChild(card);
			}
		}

		_active = true;
		Visible = true;
	}

	private Panel CreateCard(int index, string label, string desc, Color color)
	{
		var card = new Panel();
		card.CustomMinimumSize = new Vector2(180, 200);

		var style = new StyleBoxFlat
		{
			BgColor = CardBg,
			BorderWidthLeft = 3,
			BorderWidthRight = 3,
			BorderWidthTop = 3,
			BorderWidthBottom = 3,
			BorderColor = color,
			ContentMarginLeft = 8,
			ContentMarginRight = 8,
			ContentMarginTop = 8,
			ContentMarginBottom = 8
		};
		card.AddThemeStyleboxOverride("panel", style);

		var vbox = new VBoxContainer();
		vbox.CustomMinimumSize = new Vector2(164, 184);
		card.AddChild(vbox);

		var numLabel = new Label { Text = $"{index}" };
		numLabel.AddThemeFontSizeOverride("font_size", 14);
		numLabel.AddThemeColorOverride("font_color", color);
		vbox.AddChild(numLabel);

		var iconRect = new ColorRect
		{
			CustomMinimumSize = new Vector2(32, 32),
			Color = color
		};
		vbox.AddChild(iconRect);

		var nameLabel = new Label { Text = label };
		nameLabel.AddThemeFontSizeOverride("font_size", 13);
		nameLabel.CustomMinimumSize = new Vector2(164, 0);
		nameLabel.AutowrapMode = TextServer.AutowrapMode.WordSmart;
		vbox.AddChild(nameLabel);

		var descLabel = new Label { Text = desc };
		descLabel.AddThemeFontSizeOverride("font_size", 10);
		descLabel.AddThemeColorOverride("font_color", new Color(0.7f, 0.7f, 0.7f));
		descLabel.CustomMinimumSize = new Vector2(164, 0);
		descLabel.AutowrapMode = TextServer.AutowrapMode.WordSmart;
		vbox.AddChild(descLabel);

		card.GuiInput += @event =>
		{
			if (@event is InputEventMouseButton mb && mb.Pressed && mb.ButtonIndex == MouseButton.Left)
				SelectIndex(index - 1);
		};

		return card;
	}

	public void Cancel()
	{
		_active = false;
		Visible = false;
		_currentChoiceIds.Clear();
	}

	public override void _UnhandledInput(InputEvent @event)
	{
		if (!_active) return;

		if (@event is InputEventKey key && key.Pressed && !key.Echo)
		{
			if (key.Keycode == Key.Escape)
			{
				SelectIndex(-1);
			}
			else if (key.Keycode == Key.Key1)
			{
				SelectIndex(0);
			}
			else if (key.Keycode == Key.Key2)
			{
				SelectIndex(1);
			}
			else if (key.Keycode == Key.Key3)
			{
				SelectIndex(2);
			}
		}
	}

	private void SelectIndex(int index)
	{
		if (!_active) return;

		string chosenId = "";
		if (index >= 0 && index < _currentChoiceIds.Count)
			chosenId = _currentChoiceIds[index];

		_active = false;
		Visible = false;
		_currentChoiceIds.Clear();

		GetViewport().SetInputAsHandled();
		EmitSignal(SignalName.ChoiceSelected, chosenId);
	}
}
