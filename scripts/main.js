// ЧИЧТЫ

Events.on(ClientLoadEvent, () => {
    let menuVisible = true;
    let menuPanel = null;
    let disclaimerShown = false;
    let spamActive = false;
    let spamTimer = null;
    let spamCount = 0;
    let totalSpawned = 0;
    let effectsEnabled = true;
    let shakeEnabled = true;
    let soundVolumeIndex = 2;
    let spawnCountIndex = 0;
    let intervalIndex = 1;
    let spreadIndex = 1;
    let locationIndex = 0;
    let jokeIndex = 0;
    let logLines = [];
    let spawnedByMod = [];

    const spawnCounts = [1, 2, 4, 8];
    const intervals = [0.5, 1, 2, 5];
    const spreads = [0, 40, 80, 160];
    const soundVolumes = [0, 0.35, 0.7, 1];
    const soundLabels = ["ВЫКЛ", "35%", "70%", "100%"];
    const locationLabels = ["Игрок", "Курсор", "Ядро"];
    const jokeMessages = [
        "Чич проходит проверку на адекватность. Результат: не прошел.",
        "Античит заметил подозрительно весёлого игрока.",
        "Сервер сообщил: Чич слишком мощный для этого измерения.",
        "Внимание: обнаружено скопление Чичей. Паника."
    ];

    function recordAction(message) {
        logLines.unshift("[lightgray]" + message + "[]");
        if (logLines.length > 4) logLines.pop();
    }

    function playExplosion(x, y) {
        if (soundVolumes[soundVolumeIndex] > 0) {
            Sounds.explosion.at(x, y, 1, soundVolumes[soundVolumeIndex]);
        }
    }

    function playSpawnEffects(x, y) {
        if (effectsEnabled) {
            Fx.impactReactorExplosion.at(x, y);
            Fx.bigShockwave.at(x, y);
        }
        playExplosion(x, y);
        if (shakeEnabled) Effect.shake(5, 15, x, y);
    }

    function stopSpam() {
        spamActive = false;
        if (spamTimer != null) {
            spamTimer.cancel();
            spamTimer = null;
        }
    }

    function showDisclaimer() {
        if (disclaimerShown) return;
        disclaimerShown = true;
        Time.run(2, () => {
            if (Vars.state != null && (Vars.state.isMenu() || Vars.state.isGame())) {
                Vars.ui.showInfoText(
                    "Дисклеймер — ЧИЧТЫ",
                    "Это шуточный мод-меню для Mindustry.\n\n" +
                    "В одиночной игре, на своих серверах и в песочнице меню работает напрямую и без ограничений.\n\n" +
                    "На чужих онлайн-серверах почти все функции блокируются сервером, если у вас нет прав администратора. \n\n" +
                    "Подписывайтесь на телеграм канал мода - https://t.me/chichti_minda"
                );
            } else {
                disclaimerShown = false;
            }
        });
    }

    Events.on(StateChangeEvent, event => {
        if (event.to != null && String(event.to) === "menu") {
            stopSpam();
            spawnedByMod = [];
            return;
        }
    });

    Time.run(30, () => showDisclaimer());

    // Берём все доступные типы юнитов, включая добавленные другими модами.
    const unitTypes = [];
    Vars.content.units().each(cons(unitType => {
        if (!unitType.internal) unitTypes.push(unitType);
    }));
    let selectedUnitType = UnitTypes.corvus;

    function showUnitSelector() {
        let dialog = new BaseDialog("Выбор юнита");
        let listTable = null;
        let searchText = "";

        function rebuildList() {
            if (listTable == null) return;
            listTable.clearChildren();
            listTable.defaults().size(250, 42).pad(3);
            let shown = 0;
            for (let i = 0; i < unitTypes.length; i++) {
                let unitType = unitTypes[i];
                let localizedName = String(unitType.localizedName);
                let internalName = String(unitType.name);
                if (searchText.length > 0 &&
                    localizedName.toLowerCase().indexOf(searchText) === -1 &&
                    internalName.toLowerCase().indexOf(searchText) === -1) continue;

                listTable.button(unitType.localizedName, Styles.flatBordert, () => {
                    selectedUnitType = unitType;
                    recordAction("Выбран юнит: " + unitType.localizedName);
                    dialog.hide();
                }).growX();
                shown++;
                if (shown % 2 === 0) listTable.row();
            }
            if (shown % 2 !== 0) listTable.add().size(250, 42);
            if (shown === 0) listTable.add("Юниты не найдены").colspan(2).pad(12);
        }

        let searchField = dialog.cont.field("", text => {
            searchText = String(text).toLowerCase();
            rebuildList();
        }).growX().pad(8).get();
        searchField.setMessageText("Поиск юнита");
        dialog.cont.pane(cons(list => {
            listTable = list;
            rebuildList();
        })).grow().maxHeight(500);
        dialog.addCloseButton();
        dialog.show();
    }

    function getPlayerPos() {
        if (!Vars.player) return { x: 0, y: 0 };
        return { x: Vars.player.x, y: Vars.player.y };
    }

    function getSpawnPos() {
        let playerPos = getPlayerPos();
        if (locationIndex === 1 && Vars.player) {
            return { x: Vars.player.mouseX, y: Vars.player.mouseY };
        }
        if (locationIndex === 2 && Vars.player) {
            let core = Vars.player.core();
            if (core != null) return { x: core.x, y: core.y };
        }
        return playerPos;
    }

    function pruneSpawnedUnits() {
        for (let i = spawnedByMod.length - 1; i >= 0; i--) {
            try {
                if (spawnedByMod[i] == null || !spawnedByMod[i].isAdded()) spawnedByMod.splice(i, 1);
            } catch (e) {
                spawnedByMod.splice(i, 1);
            }
        }
    }

    function spawnSelected(count) {
        pruneSpawnedUnits();
        let pos = getSpawnPos();
        let unitType = selectedUnitType;
        let team = Vars.player.team();
        let spread = spreads[spreadIndex];
        let created = 0;
        for (let i = 0; i < count; i++) {
            let offsetX = spread === 0 ? 0 : (Math.random() - 0.5) * spread;
            let offsetY = spread === 0 ? 0 : (Math.random() - 0.5) * spread;
            let unit = unitType.spawn(team, pos.x + offsetX, pos.y + offsetY);
            if (unit != null) {
                spawnedByMod.push(unit);
                created++;
            }
        }
        totalSpawned += created;
        return { pos: pos, unitType: unitType, count: created };
    }

    function spawnSpamBatch() {
        if (!spamActive || !Vars.state || !Vars.state.isPlaying() || !Vars.player) return;
        try {
            let spawned = spawnSelected(spawnCounts[spawnCountIndex]);
            spamCount += spawned.count;
            if (effectsEnabled) Fx.spawn.at(spawned.pos.x, spawned.pos.y);
        } catch (err) {
            stopSpam();
            Vars.ui.hudfrag.showToast("[scarlet]Автоспавн остановлен из-за ошибки[]");
        }
    }

    function scheduleSpam() {
        if (spamTimer != null) spamTimer.cancel();
        spamTimer = Timer.schedule(() => spawnSpamBatch(), 0, intervals[intervalIndex]);
    }

    Events.on(StateChangeEvent, event => {
        if (event.to != null && String(event.to) === "menu") {
            stopSpam();
            spawnedByMod = [];
        }
    });

    Vars.ui.hudGroup.fill(cons(table => {
        table.top().right();
        table.update(() => {
            let inGame = Vars.state != null && Vars.state.isGame();
            table.visible = inGame;
            if (inGame && Vars.state.isPlaying() && !disclaimerShown) showDisclaimer();
        });

        table.table(cons(container => {
            container.top().right().margin(10);
            container.button("[accent]ЧИЧТЫ — свернуть / развернуть", Styles.cleart, () => {
                menuVisible = !menuVisible;
                if (menuPanel != null) menuPanel.visible = menuVisible;
            }).size(210, 36).padBottom(4).row();

            container.table(Styles.black8, cons(menu => {
                menuPanel = menu;
                menu.margin(10);
                menu.add("[scarlet]Ч И Ч Т Ы[]").style(Styles.outlineLabel).padBottom(7).row();

                menu.button("[accent]ВЫБРАТЬ ЮНИТА[]", Styles.flatBordert, () => showUnitSelector())
                    .size(270, 36).pad(2).row();
                menu.label(prov(() => "[stat]Выбран: " + selectedUnitType.localizedName + "[]"))
                    .width(270).wrap().left().padBottom(5).row();

                menu.button("[lime]ВЫДАТЬ выбранный юнит[]", Styles.flatBordert, () => {
                    try {
                        let spawned = spawnSelected(spawnCounts[spawnCountIndex]);
                        if (effectsEnabled) {
                            Fx.impactReactorExplosion.at(spawned.pos.x, spawned.pos.y);
                            Fx.bigShockwave.at(spawned.pos.x, spawned.pos.y);
                        }
                        playExplosion(spawned.pos.x, spawned.pos.y);
                        if (shakeEnabled) Effect.shake(5, 15, spawned.pos.x, spawned.pos.y);
                        Vars.ui.hudfrag.showToast("[lime]Призвано ×" + spawned.count + " " + spawned.unitType.localizedName + "[]");
                        recordAction("Призыв ×" + spawned.count + " " + spawned.unitType.localizedName);
                    } catch (e) {
                        Vars.ui.hudfrag.showToast("[scarlet]Ошибка спавна: " + String(e) + "[]");
                    }
                }).size(270, 38).pad(2).row();

                menu.table(cons(config => {
                    config.button("Количество +", Styles.flatBordert, () => {
                        spawnCountIndex = (spawnCountIndex + 1) % spawnCounts.length;
                        recordAction("Количество за цикл: " + spawnCounts[spawnCountIndex]);
                    }).size(130, 32);
                    config.button("Интервал +", Styles.flatBordert, () => {
                        intervalIndex = (intervalIndex + 1) % intervals.length;
                        if (spamActive) scheduleSpam();
                        recordAction("Интервал автоспавна: " + intervals[intervalIndex] + "с");
                    }).size(130, 32);
                })).pad(2).row();
                menu.label(prov(() => "[accent]×" + spawnCounts[spawnCountIndex] + " за цикл · " + intervals[intervalIndex] + " сек[]"))
                    .left().row();

                menu.table(cons(config => {
                    config.button("Место +", Styles.flatBordert, () => {
                        locationIndex = (locationIndex + 1) % locationLabels.length;
                        recordAction("Место появления: " + locationLabels[locationIndex]);
                    }).size(130, 32);
                    config.button("Разброс +", Styles.flatBordert, () => {
                        spreadIndex = (spreadIndex + 1) % spreads.length;
                        recordAction("Разброс появления: " + spreads[spreadIndex]);
                    }).size(130, 32);
                })).pad(2).row();
                menu.label(prov(() => "[accent]Место: " + locationLabels[locationIndex] + " · разброс: " + spreads[spreadIndex] + "[]"))
                    .left().row();

                menu.button("[scarlet]БЕСКОНЕЧНЫЙ КРЕМНИЙ[]", Styles.flatBordert, () => {
                    try {
                        let core = Vars.player.core();
                        if (core != null) {
                            core.items.set(Items.silicon, 99999);
                            if (effectsEnabled) Fx.healWave.at(core.x, core.y);
                            Vars.ui.hudfrag.showToast("[accent]+99999 Кремния в ядро![]");
                            recordAction("Выдан кремний");
                        } else {
                            Vars.ui.hudfrag.showToast("[scarlet]Ядро не найдено![]");
                        }
                    } catch (e) {
                        Vars.ui.hudfrag.showToast("[scarlet]Ошибка выдачи кремния: " + String(e) + "[]");
                    }
                }).size(270, 36).pad(2).row();

                menu.label(prov(() => (spamActive ? "[green]" : "[scarlet]") + "АВТОСПАВН: " + (spamActive ? "ВКЛ · " + spamCount : "ВЫКЛ") + "[]"))
                    .left().row();
                menu.button("[accent]Старт / стоп автоспавна[]", Styles.flatBordert, () => {
                    if (spamActive) {
                        stopSpam();
                        recordAction("Автоспавн остановлен");
                        Vars.ui.hudfrag.showToast("[scarlet]Автоспавн выключен[]");
                    } else {
                        spamActive = true;
                        spamCount = 0;
                        scheduleSpam();
                        recordAction("Автоспавн включён");
                        Vars.ui.hudfrag.showToast("[green]Автоспавн включён[]");
                    }
                }).size(270, 36).pad(2).row();

                menu.button("[scarlet]Очистить юниты, созданные меню[]", Styles.flatBordert, () => {
                    let removed = 0;
                    for (let i = spawnedByMod.length - 1; i >= 0; i--) {
                        try {
                            let unit = spawnedByMod[i];
                            if (unit != null && unit.isAdded()) {
                                unit.kill();
                                removed++;
                            }
                        } catch (e) { }
                    }
                    spawnedByMod = [];
                    recordAction("Очищено юнитов: " + removed);
                    Vars.ui.hudfrag.showToast("[accent]Удалено созданных модом юнитов: " + removed + "[]");
                }).size(270, 34).pad(2).row();
                menu.label(prov(() => {
                    pruneSpawnedUnits();
                    return "[lightgray]Создано меню и живо: " + spawnedByMod.length + "[]";
                })).left().row();

                menu.table(cons(options => {
                    options.button("Эффекты вкл/выкл", Styles.flatBordert, () => {
                        effectsEnabled = !effectsEnabled;
                        recordAction("Эффекты " + (effectsEnabled ? "включены" : "выключены"));
                    }).size(130, 32);
                    options.button("Тряска вкл/выкл", Styles.flatBordert, () => {
                        shakeEnabled = !shakeEnabled;
                        recordAction("Тряска " + (shakeEnabled ? "включена" : "выключена"));
                    }).size(130, 32);
                })).pad(2).row();
                menu.label(prov(() => "[accent]Эффекты: " + (effectsEnabled ? "ВКЛ" : "ВЫКЛ") + " · тряска: " + (shakeEnabled ? "ВКЛ" : "ВЫКЛ") + "[]"))
                    .left().row();
                menu.button("[accent]Изменить громкость звука[]", Styles.flatBordert, () => {
                    soundVolumeIndex = (soundVolumeIndex + 1) % soundVolumes.length;
                    recordAction("Громкость звука: " + soundLabels[soundVolumeIndex]);
                }).size(270, 34).pad(2).row();
                menu.label(prov(() => "[accent]Громкость звука: " + soundLabels[soundVolumeIndex] + "[]"))
                    .left().row();

                menu.button("[scarlet]СЮРПРИЗ ДЛЯ ЧИЧА[]", Styles.flatBordert, () => {
                    let pos = getPlayerPos();
                    let message = jokeMessages[jokeIndex];
                    jokeIndex = (jokeIndex + 1) % jokeMessages.length;
                    if (effectsEnabled) {
                        Fx.spawn.at(pos.x, pos.y);
                        Fx.bigShockwave.at(pos.x, pos.y);
                    }
                    playExplosion(pos.x, pos.y);
                    if (shakeEnabled) Effect.shake(8, 18, pos.x, pos.y);
                    Vars.ui.hudfrag.showToast("[scarlet]" + message + "[]");
                    recordAction("Сюрприз для Чича");
                }).size(270, 34).pad(2).row();

                menu.button("[scarlet]ЗАБАНИТЬ ЧИЧА[]", Styles.flatBordert, () => {
                    let pos = getPlayerPos();
                    for (let i = 0; i < 5; i++) {
                        Time.run(i * 4, () => {
                            if (effectsEnabled) {
                                Fx.reactorExplosion.at(pos.x + (Math.random() - 0.5) * 60, pos.y + (Math.random() - 0.5) * 60);
                                Fx.bigShockwave.at(pos.x, pos.y);
                            }
                        });
                    }
                    playExplosion(pos.x, pos.y);
                    if (shakeEnabled) Effect.shake(20, 40, pos.x, pos.y);
                    if (Vars.player && Vars.player.unit()) Vars.player.unit().kill();
                    Vars.ui.hudfrag.showToast("[scarlet]ЧИЧ БЫЛ УСПЕШНО ЗАБАНЕН АНТИЧИТОМ![]");
                    recordAction("Чич забанен (понарошку)");
                }).size(270, 34).pad(2).row();

                menu.label(prov(() => "[lightgray]Всего призвано: " + totalSpawned + "[]")).left().padTop(3).row();
                menu.add("[accent]Последние действия[]").left().padTop(2).row();
                for (let i = 0; i < 4; i++) {
                    let logIndex = i;
                    menu.label(prov(() => logLines[logIndex] || "[darkgray]—[]"))
                        .left().width(270).wrap().row();
                }
            }));
        }));
    }));
});
