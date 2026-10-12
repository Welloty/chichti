// ==========================================
// ЧИЧТЫ: Рофло-мод меню для Mindustry v146+
// ==========================================

Events.on(ClientLoadEvent, () => {
    let menuVisible = true;
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
        "Чич прошёл проверку на адекватность. Результат: не найден.",
        "Античит заметил подозрительно весёлого игрока.",
        "Сервер сообщил: Чич слишком мощный для этого измерения.",
        "Внимание: обнаружено скопление Чичей. Паника отменяется."
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

    Events.on(StateChangeEvent, event => {
        if (event.to != null && String(event.to) === "menu") {
            stopSpam();
            spawnedByMod = [];
        }
    });

    const t5Units = [
        UnitTypes.corvus,
        UnitTypes.toxopid,
        UnitTypes.eclipse,
        UnitTypes.omura,
        UnitTypes.reign
    ];
    let selectedUnitIndex = 0;

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
        let unitType = t5Units[selectedUnitIndex];
        let team = Vars.player.team();
        let spread = spreads[spreadIndex];
        for (let i = 0; i < count; i++) {
            let offsetX = spread === 0 ? 0 : (Math.random() - 0.5) * spread;
            let offsetY = spread === 0 ? 0 : (Math.random() - 0.5) * spread;
            let unit = unitType.spawn(team, pos.x + offsetX, pos.y + offsetY);
            if (unit != null) spawnedByMod.push(unit);
        }
        totalSpawned += count;
        return { pos: pos, unitType: unitType };
    }

    function spawnSpamBatch() {
        if (!spamActive || !Vars.state || !Vars.state.isPlaying() || !Vars.player) return;
        try {
            let count = spawnCounts[spawnCountIndex];
            let spawned = spawnSelected(count);
            spamCount += count;
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

    Vars.ui.hudGroup.fill(cons(table => {
        table.top().right();
        table.update(() => {
            table.visible = Vars.state != null && Vars.state.isGame();
        });

        table.table(cons(container => {
            container.top().right().margin(10);

            container.button("[accent]ЧИЧТЫ — свернуть / развернуть", Styles.cleart, () => {
                menuVisible = !menuVisible;
            }).size(190, 36).padBottom(4).row();

            container.table(Styles.black8, cons(menu => {
                menu.update(() => { menu.visible = menuVisible; });
                menu.margin(10);
                menu.add("[scarlet]Ч И Ч Т Ы[]").style(Styles.outlineLabel).padBottom(7).row();

                menu.table(cons(selector => {
                    selector.button("<", Styles.flatBordert, () => {
                        selectedUnitIndex = (selectedUnitIndex - 1 + t5Units.length) % t5Units.length;
                    }).size(30, 30);
                    selector.label(prov(() => "[stat]" + t5Units[selectedUnitIndex].localizedName + "[]"))
                        .width(145).center();
                    selector.button(">", Styles.flatBordert, () => {
                        selectedUnitIndex = (selectedUnitIndex + 1) % t5Units.length;
                    }).size(30, 30);
                })).padBottom(5).row();

                menu.button(prov(() => "[lime]ВЫДАТЬ выбранный ×" + spawnCounts[spawnCountIndex] + "[]"), Styles.flatBordert, () => {
                    try {
                        let spawned = spawnSelected(spawnCounts[spawnCountIndex]);
                        playSpawnEffects(spawned.pos.x, spawned.pos.y);
                        Vars.ui.hudfrag.showToast("[lime]Призвано ×" + spawnCounts[spawnCountIndex] + " " + spawned.unitType.localizedName + "[]");
                        recordAction("Призыв ×" + spawnCounts[spawnCountIndex] + " " + spawned.unitType.localizedName);
                    } catch (e) {
                        Vars.ui.hudfrag.showToast("[scarlet]Ошибка спавна: " + String(e) + "[]");
                    }
                }).size(270, 40).pad(3).row();

                menu.table(cons(config => {
                    config.button(prov(() => "Количество: " + spawnCounts[spawnCountIndex]), Styles.flatBordert, () => {
                        spawnCountIndex = (spawnCountIndex + 1) % spawnCounts.length;
                        recordAction("Количество за цикл: " + spawnCounts[spawnCountIndex]);
                    }).size(130, 32);
                    config.button(prov(() => "Интервал: " + intervals[intervalIndex] + "с"), Styles.flatBordert, () => {
                        intervalIndex = (intervalIndex + 1) % intervals.length;
                        if (spamActive) scheduleSpam();
                        recordAction("Интервал автоспавна: " + intervals[intervalIndex] + "с");
                    }).size(130, 32);
                })).pad(2).row();

                menu.table(cons(config => {
                    config.button(prov(() => "Место: " + locationLabels[locationIndex]), Styles.flatBordert, () => {
                        locationIndex = (locationIndex + 1) % locationLabels.length;
                        recordAction("Место появления: " + locationLabels[locationIndex]);
                    }).size(130, 32);
                    config.button(prov(() => "Разброс: " + spreads[spreadIndex]), Styles.flatBordert, () => {
                        spreadIndex = (spreadIndex + 1) % spreads.length;
                        recordAction("Разброс появления: " + spreads[spreadIndex]);
                    }).size(130, 32);
                })).pad(2).row();

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
                }).size(270, 38).pad(3).row();

                menu.label(prov(() => {
                    return (spamActive ? "[green]" : "[scarlet]") + "АВТОСПАВН: " + (spamActive ? "ВКЛ · " + spamCount : "ВЫКЛ") + "[]";
                })).left().row();
                menu.table(cons(spamButtons => {
                    spamButtons.button("[accent]Старт / стоп[]", Styles.flatBordert, () => {
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
                    }).size(130, 34);
                    spamButtons.label(prov(() => "[lightgray]×" + spawnCounts[spawnCountIndex] + " / " + intervals[intervalIndex] + "с[]"))
                        .width(130).center();
                })).pad(2).row();

                menu.button(prov(() => {
                    pruneSpawnedUnits();
                    return "[scarlet]Очистить юнитов мода (" + spawnedByMod.length + ")[]";
                }), Styles.flatBordert, () => {
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
                }).size(270, 36).pad(2).row();

                menu.table(cons(options => {
                    options.button(prov(() => "Эффекты: " + (effectsEnabled ? "ВКЛ" : "ВЫКЛ")), Styles.flatBordert, () => {
                        effectsEnabled = !effectsEnabled;
                        recordAction("Эффекты " + (effectsEnabled ? "включены" : "выключены"));
                    }).size(130, 32);
                    options.button(prov(() => "Тряска: " + (shakeEnabled ? "ВКЛ" : "ВЫКЛ")), Styles.flatBordert, () => {
                        shakeEnabled = !shakeEnabled;
                        recordAction("Тряска " + (shakeEnabled ? "включена" : "выключена"));
                    }).size(130, 32);
                })).pad(2).row();

                menu.button(prov(() => "[accent]Громкость эффектов: " + soundLabels[soundVolumeIndex] + "[]"), Styles.flatBordert, () => {
                    soundVolumeIndex = (soundVolumeIndex + 1) % soundVolumes.length;
                    recordAction("Громкость эффектов: " + soundLabels[soundVolumeIndex]);
                }).size(270, 34).pad(2).row();

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
                }).size(270, 36).pad(2).row();

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
                }).size(270, 36).pad(2).row();

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
