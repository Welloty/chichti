// ==========================================
// ЧИЧТЫ: Рофло Мод-Меню для Mindustry (v146+)
// ==========================================

Events.on(ClientLoadEvent, () => {
    let menuVisible = true;
    let spamActive = false;
    let spamTimer = null;
    let spamCount = 0;

    function stopSpam() {
        spamActive = false;
        if (spamTimer != null) {
            spamTimer.cancel();
            spamTimer = null;
        }
    }

    // Останавливаем таймер при возврате в главное меню.
    Events.on(StateChangeEvent, event => {
        if (event.to != null && String(event.to) === "menu") {
            stopSpam();
        }
    });

    // Список доступных Т5 юнитов для спама и спавна
    const t5Units = [
        UnitTypes.corvus,   // Ворон
        UnitTypes.toxopid,  // Токсопид
        UnitTypes.eclipse,  // Затмение
        UnitTypes.omura,    // Омура
        UnitTypes.reign     // Царство
    ];
    let selectedUnitIndex = 0; // По умолчанию Corvus (Ворон)

    function getPlayerPos() {
        if (!Vars.player) return { x: 0, y: 0 };
        return {
            x: Vars.player.x,
            y: Vars.player.y
        };
    }

    // Создаем интерфейс в общем HUD
    Vars.ui.hudGroup.fill(cons(table => {
        table.top().right();

        // Отображать только когда идет реальная игра
        // Обновляем boolean-поле напрямую: Rhino некорректно разрешает здесь visible(Boolp).
        table.update(() => {
            table.visible = Vars.state != null && Vars.state.isGame();
        });

        // Контейнер всего мод-меню
        table.table(cons(container => {
            container.top().right().margin(10);

            // 1. Маленькая кнопка сворачивания/разворачивания
            container.table(cons(header => {
                header.button("[accent]ЧИЧТЫ — свернуть / развернуть", Styles.cleart, () => {
                    menuVisible = !menuVisible;
                }).size(130, 36).padBottom(4);
            })).right().row();

            // 2. Основная панель читов (точно как на скриншоте)
            container.table(Styles.black8, cons(menu => {
                menu.update(() => {
                    menu.visible = menuVisible;
                }); // Скрывать при сворачивании
                menu.margin(12);

                // Заголовок
                menu.add("[scarlet]Ч И Ч Т Ы[]")
                    .style(Styles.outlineLabel)
                    .padBottom(10)
                    .row();

                // Выбор типа юнита (для разнообразия)
                menu.table(cons(selector => {
                    selector.button("<", Styles.flatBordert, () => {
                        selectedUnitIndex = (selectedUnitIndex - 1 + t5Units.length) % t5Units.length;
                    }).size(32, 32);

                    selector.label(prov(() => "[stat]" + t5Units[selectedUnitIndex].localizedName + "[]"))
                        .width(140)
                        .center();

                    selector.button(">", Styles.flatBordert, () => {
                        selectedUnitIndex = (selectedUnitIndex + 1) % t5Units.length;
                    }).size(32, 32);
                })).padBottom(8).row();

                // ----------------------------------------------------
                // КНОПКА: ВЫДАТЬ выбранный юнит (4 шт сразу)
                // ----------------------------------------------------
                menu.button("[lime]ВЫДАТЬ выбранный юнит ×4[]", Styles.flatBordert, () => {
                    try {
                        let pos = getPlayerPos();
                        let unitType = t5Units[selectedUnitIndex];
                        let team = Vars.player.team();

                        for (let i = 0; i < 4; i++) {
                            let offsetX = (Math.random() - 0.5) * 80;
                            let offsetY = (Math.random() - 0.5) * 80;
                            unitType.spawn(team, pos.x + offsetX, pos.y + offsetY);
                        }

                        // Эффекты взрыва и зеленых молний, как на скрине
                        Fx.impactReactorExplosion.at(pos.x, pos.y);
                        Fx.bigShockwave.at(pos.x, pos.y);
                        Sounds.explosion.at(pos.x, pos.y);
                        Effect.shake(5, 15, pos.x, pos.y);

                        Vars.ui.hudfrag.showToast("[lime]4x " + unitType.localizedName + " успешно призваны![]");
                    } catch (e) {
                        Vars.ui.hudfrag.showToast("[scarlet]Ошибка спавна: " + String(e) + "[]");
                    }
                }).size(260, 48).pad(4).get();
                menu.row();

                // ----------------------------------------------------
                // КНОПКА: БЕСКОНЕЧНЫЙ КРЕМНИЙ
                // ----------------------------------------------------
                menu.button("[scarlet]БЕСКОНЕЧНЫЙ КРЕМНИЙ[]", Styles.flatBordert, () => {
                    try {
                        let core = Vars.player.core();
                        if (core != null) {
                            core.items.set(Items.silicon, 99999);
                            Fx.healWave.at(core.x, core.y);
                            Vars.ui.hudfrag.showToast("[accent]+99999 Кремния в ядро![]");
                        } else {
                            Vars.ui.hudfrag.showToast("[scarlet]Ядро не найдено![]");
                        }
                    } catch (e) {
                        Vars.ui.hudfrag.showToast("[scarlet]Ошибка выдачи кремния: " + String(e) + "[]");
                    }
                }).size(260, 44).pad(4).row();

                // ----------------------------------------------------
                // КНОПКА: СПАМ Т5 (в секунду)
                // ----------------------------------------------------
                menu.label(prov(() => {
                        let statusColor = spamActive ? "[green]" : "[scarlet]";
                        let statusText = spamActive ? spamCount : "0";
                        return statusColor + "СПАМ Т5 (в секунду)    " + statusText + "[]";
                    })).left().row();
                menu.button("[accent]Переключить автоспам", Styles.flatBordert, () => {
                    spamActive = !spamActive;

                    if (spamActive) {
                        spamCount = 0;
                        spamTimer = Timer.schedule(() => {
                            if (!spamActive || !Vars.state || !Vars.state.isPlaying() || !Vars.player) return;
                            try {
                                let pos = getPlayerPos();
                                let unitType = t5Units[selectedUnitIndex];
                                unitType.spawn(Vars.player.team(), pos.x, pos.y);
                                spamCount++;
                                Fx.spawn.at(pos.x, pos.y);
                            } catch (err) {
                                stopSpam();
                                Vars.ui.hudfrag.showToast("[scarlet]Автоспам остановлен из-за ошибки спавна[]");
                            }
                        }, 0, 1); // Каждую 1 секунду
                        Vars.ui.hudfrag.showToast("[green]Автоспам Т5 ВКЛЮЧЕН![]");
                    } else {
                        stopSpam();
                        Vars.ui.hudfrag.showToast("[scarlet]Автоспам Т5 ВЫКЛЮЧЕН![]");
                    }
                }).size(260, 44).pad(4).row();

                // ----------------------------------------------------
                // КНОПКА: ЗАБАНИТЬ ЧИЧА
                // ----------------------------------------------------
                menu.button("[scarlet]ЗАБАНИТЬ ЧИЧА[]", Styles.flatBordert, () => {
                    let pos = getPlayerPos();

                    // Огромный ядерный взрыв и звуки
                    for (let i = 0; i < 5; i++) {
                        Time.run(i * 4, () => {
                            Fx.reactorExplosion.at(pos.x + (Math.random() - 0.5) * 60, pos.y + (Math.random() - 0.5) * 60);
                            Fx.bigShockwave.at(pos.x, pos.y);
                        });
                    }
                    Sounds.explosion.at(pos.x, pos.y);
                    Effect.shake(20, 40, pos.x, pos.y);

                    // Убить юнита игрока ради рофла
                    if (Vars.player && Vars.player.unit()) {
                        Vars.player.unit().kill();
                    }

                    // Сообщение о бане
                    Vars.ui.hudfrag.showToast(
                        "[scarlet]ЧИЧ БЫЛ УСПЕШНО ЗАБАНЕН АНТИЧИТОМ![]"
                    );
                }).size(260, 44).pad(4).row();

            }));

        }));
    }));
});
