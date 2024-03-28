import {DiscordSDK} from "@discord/embedded-app-sdk";
import "./style.css";
import {unityInstance} from "./unity-code.js";

export let userInfo = {
    id: "",
    displayName: "Unknown",
    username: "Unknown",
    avatarUrl: "",

    guildId: "",
    guildName: "Unknown",
    guildAvatarUrl: "",
    channelId: "",
    channelName: "Unknown"
};

export let discordSdk;
export let auth;

export function init_discord_sdk() {
    const cdn = `https://cdn.discordapp.com`
    discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);

    async function prepareUserInfo() {
        const newAuth = await discordSdk.commands.authenticate({access_token: auth.access_token});
        const user = newAuth.user;
        userInfo.username = user.username;

        if (discordSdk.channelId != null && discordSdk.guildId != null) {
            const channel = await discordSdk.commands.getChannel({channel_id: discordSdk.channelId});
            if (channel.name != null) {
                userInfo.channelName = channel.name;
                userInfo.channelId = channel.id;
            }
        } else logError("Channel not found");


        const guilds = await fetch(`https://discord.com/api/v10/users/@me/guilds`, {
            headers: {
                Authorization: `Bearer ${auth.access_token}`,
                'Content-Type': 'application/json',
            },
        }).then((response) => response.json());

        const currentGuild = guilds.find((g) => g.id === discordSdk.guildId);

        if (currentGuild != null) {
            userInfo.guildName = currentGuild.name;
            userInfo.guildId = currentGuild.id;
            userInfo.guildAvatarUrl = `https://cdn.discordapp.com/icons/${currentGuild.id}/${currentGuild.icon}.webp?size=128`;
        } else logError("Guild not found");

        const guildMember = await fetch(
            `/discord/api/users/@me/guilds/${discordSdk.guildId}/member`,
            {
                method: 'get',
                headers: {Authorization: `Bearer ${auth.access_token}`},
            }
        ).then((j) => j.json()).catch(() => {
            return null;
        });

        if (guildMember != null) {
            userInfo.id = user.id;
            document.querySelector('#debug').innerHTML = `<h2>Guild member = ${guildMember}</h2>`

            if (guildMember?.avatar != null && discordSdk.guildId != null) {
                return `${cdn}/guilds/${discordSdk.guildId}/users/${user.id}/avatars/${guildMember.avatar}.png?size=${size}`;
            }
            if (user.avatar != null) {
                return `${cdn}/avatars/${user.id}/${user.avatar}.png?size=${256}`;
            }

            const defaultAvatarIndex = Math.abs(Number(user.id) >> 22) % 6;
            userInfo.avatarUrl = `${cdn}/embed/avatars/${defaultAvatarIndex}.png?size=${256}`;
        }

        sendUserInfo()
    }

    setupDiscordSdk().then(() => {
        logInfo("Discord SDK is authenticated");
        document.querySelector('#debug').innerHTML = `<h2>Discord SDK is authenticated!!</h2>`
        unityInstance.SendMessage('DiscordSdk', 'SetDiscordReady', true)

        prepareUserInfo().then(() => {
            document.querySelector('#debug').innerHTML = `<h2>UserInfo = ${userInfo}</h2>`
        })
    }).catch(error => logError(error));

    async function setupDiscordSdk() {
        await discordSdk.ready();
        logInfo("Discord SDK is ready");

        const {code} = await discordSdk.commands.authorize({
            client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
            response_type: "code",
            state: "",
            prompt: "none",
            scope: [
                "identify",
                "guilds",
                'guilds.members.read',
                'rpc.voice.read',
            ],
        });
        const response = await fetch("/api/token", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({code}),
        });
        const {access_token} = await response.json();
        auth = await discordSdk.commands.authenticate({access_token});

        if (auth == null) logError("Authenticate command failed");
        else logInfo("Authenticated with Discord");
    }

    function sendUserInfo() {
        const userIndoJSON = JSON.stringify(userInfo)
        logInfo("Sending user info: " + userIndoJSON)
        unityInstance.SendMessage('DiscordSdk', 'SetUserInfo', userIndoJSON)
    }
}