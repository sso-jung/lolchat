require("dotenv").config();
const Fastify = require("fastify");
const { PrismaClient } = require("@prisma/client");

const fastify = Fastify({ logger: true });
const prisma = new PrismaClient();

const fs = require("fs");
const path = require("path");

const champions = JSON.parse(fs.readFileSync(path.join(__dirname, "data/champions.json"), "utf8"));
const skillsByChampion = JSON.parse(fs.readFileSync(path.join(__dirname, "data/skills.json"), "utf8"));

function pickOne(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function getSkillSlotLabel(skillId = "") {
    const m = String(skillId).match(/_([PQWER])$/);
    return m ? m[1] : "?";
}

const roleNameMap = {
    TANKER: "탱커",
    MAGE: "메이지",
    ASSASSIN: "암살자",
    ADC: "원거리 딜러",
    SUPPORTER: "서포터",
    FIGHTER: "브루저",
};

// 간단 쿨타임 체크 유틸
function assertCooldown(lastAt, sec) {
    if (!lastAt) return;
    const diffMs = Date.now() - new Date(lastAt).getTime();
    if (diffMs < sec * 1000) {
        const remain = Math.ceil((sec * 1000 - diffMs) / 1000);
        const err = new Error(`쿨타임: ${remain}초 후 다시 시도`);
        err.code = "COOLDOWN";
        throw err;
    }
}

// 플레이어 가져오거나 생성
async function getOrCreatePlayer(roomId, userId) {
    let p = await prisma.player.findUnique({ where: { roomId_userId: { roomId, userId } } });
    if (!p) {
        p = await prisma.player.create({
            data: {
                roomId,
                userId,
                state: "IDLE",
                lp: 1000,
                gold: 0,
                tier: "SILVER IV",
                level: 0,
                exp: 0,
                waveCount: 0,
                dailyWaveUsed: 0,
                lastWaveRecoverAt: new Date(),
                dailyWaveResetAt: new Date(),
            },
        });
    }
    return p;
}

async function handleCommand({ roomId, userId, command }) {
    const player = await getOrCreatePlayer(roomId, userId);

    // 커맨드 라우팅(지금은 /큐 돌리기, /서렌만 최소 구현)
    if (command === "/큐 돌리기") {
        if (player.state === "PLAYING") {
            return "이미 게임 중입니다. 라인전을 진행하며 강해져 보세요.";
        }

        const champ = pickOne(champions);
        const skillPool = skillsByChampion?.[champ.id] || [];
        const startSkill = skillPool.length ? pickOne(skillPool) : null;

        const updated = await prisma.player.update({
            where: { roomId_userId: { roomId, userId } },
            data: {
                state: "PLAYING",
                championId: champ.id,
                role: champ.role,
                level: 1,
                exp: 0,
                waveCount: 5,
                dailyWaveUsed: 0,
                lastWaveRecoverAt: new Date(),
                dailyWaveResetAt: new Date(),
            },
        });

        if (startSkill) {
            await prisma.skillOwned.create({
                data: { roomId, userId, skillId: startSkill.id, skillLevel: 1 },
            });
        }

        const roleKo = roleNameMap[champ.role] || champ.role;
        const level = 1;
        const exp = 0;
        const nextExp = 100;

        const skillSlot = startSkill ? getSkillSlotLabel(startSkill.id) : null;
        const skillText = startSkill ? `${skillSlot}(${startSkill.name}) Lv1` : "없음";
        const itemText = "없음";

        // ✅ 줄바꿈 깨끗하게: 템플릿 문자열 앞 공백 제거
        return (
            `=========================
소환사의 협곡에 오신 것을 환영합니다.
=========================
챔피언 : ${champ.name} (${roleKo})
레벨 : ${level} (${exp} / ${nextExp}XP)
보유 스킬 : ${skillText}
보유 아이템 : ${itemText}`
        );
    }

    if (command === "/서렌") {
        if (player.state !== "PLAYING") {
            return `현재 게임 중이 아닙니다.
            새로운 게임을 진행하려면 큐 돌리기를 입력하세요.`
        }
        assertCooldown(player.lastSurrenderAt, 30);

        await prisma.inventory.deleteMany({ where: { roomId, userId } });
        await prisma.skillOwned.deleteMany({ where: { roomId, userId } });

        const updated = await prisma.player.update({
            where: { roomId_userId: { roomId, userId } },
            data: {
                state: "IDLE",
                championId: null,
                role: null,
                level: 0,
                exp: 0,
                waveCount: 0,
                dailyWaveUsed: 0,
                lastSurrenderAt: new Date(),
            },
        });

        return `게임이 종료되었습니다. 다시 큐를 돌려 게임을 시작할 수 있습니다. / 현재 Lp=${updated.lp}, gold=${updated.gold}`;
    }

    return `미구현 커맨드: ${command}`;
}

fastify.post("/dev/command", async (req, reply) => {
    const { roomId, userId, command } = req.body || {};
    if (!roomId || !userId || !command) {
        return reply.code(400).send({ ok: false, message: "roomId, userId, command 필요" });
    }

    try {
        const message = await handleCommand({ roomId, userId, command });
        return { ok: true, message };
    } catch (e) {
        if (e.code === "COOLDOWN") return { ok: false, message: e.message };
        req.log.error(e);
        return reply.code(500).send({ ok: false, message: "서버 오류" });
    }
});

fastify.post("/kakao/skill", async (req, reply) => {
    req.log.info(req.body, "KAKAO_SKILL_REQUEST");

    const utterance = req.body?.userRequest?.utterance || "";

    const roomId =
        req.body?.userRequest?.chat?.id ||
        req.body?.userRequest?.user?.id ||
        "unknown_room";

    const userId =
        req.body?.userRequest?.user?.id ||
        "unknown_user";

    let message;
    try {
        message = await handleCommand({ roomId, userId, command: utterance });
    } catch (e) {
        message = e.code === "COOLDOWN" ? e.message : "서버 오류";
    }

    return {
        version: "2.0",
        template: {
            outputs: [
                { simpleText: { text: message } }
            ]
        }
    };
});

fastify.get("/health", async () => ({ ok: true }));

fastify.listen({ port: process.env.PORT ? Number(process.env.PORT) : 3000, host: "0.0.0.0" });
