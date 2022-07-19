import { readFile } from "node:fs/promises"

import { RTMClient } from "@slack/rtm-api"
import { WebClient } from "@slack/web-api"
import { Client, Routes, TextChannel } from "discord.js"
import { z } from "zod"

import { dataSource } from "./db/data-source.js"
import { ChannelLink } from "./db/entities/channel-link.js"

const tokens = z
    .object({
        discord: z.string(),
        slack: z.string(),
    })
    .parse(JSON.parse(await readFile("./data/tokens.json", "utf-8")))

await dataSource.initialize()

class Bot {
    discord = new Client({
        intents: ["Guilds", "GuildMessages", "MessageContent"],
    })

    slack = new WebClient(tokens.slack)
    rtm = new RTMClient(tokens.slack)

    constructor() {
        this.discord.on("messageCreate", message => {
            // eslint-disable-next-line @typescript-eslint/no-extra-semi
            ;(async () => {
                const link = await dataSource
                    .getRepository(ChannelLink)
                    .findOne({ where: { discordId: message.channelId } })
                if (link == null) return
                if (message.member == null) return
                let text = message.content
                for (const [, attachment] of message.attachments) {
                    text += `\nAttachment: ${attachment.url}`
                }
                await this.slack.chat.postMessage({
                    channel: link.slackId,
                    text,
                    // as_user: true,
                    username: `${message.member.displayName} (Discord)`,
                    icon_url:
                        message.member.avatarURL({ extension: "png" }) ??
                        message.author.avatarURL({ extension: "png" }) ??
                        undefined,
                })
            })().catch(e => {
                console.error(e)
            })
            console.log("message", message)
        })
        this.rtm.on("message", msg_ => {
            if (!("user" in msg_)) {
                return
            }
            // eslint-disable-next-line @typescript-eslint/no-extra-semi
            ;(async () => {
                const msg = z
                    .object({
                        channel: z.string(),
                        user: z.string(),
                        text: z.optional(z.string()),
                        files: z.optional(
                            z.array(
                                z.object({
                                    name: z.string(),
                                    mimetype: z.string(),
                                    url_private: z.string(),
                                }),
                            ),
                        ),
                    })
                    .parse(msg_)
                const commandPrefix = `<@${this.rtm.activeUserId!}> `
                if (msg.text != null && msg.text.startsWith(commandPrefix)) {
                    const command = msg.text.slice(commandPrefix.length)
                    // eslint-disable-next-line prefer-named-capture-group
                    const linkCommand = /^link ([0-9]+)$/.exec(command)
                    if (linkCommand != null) {
                        await dataSource.transaction(async manager => {
                            const channelId = linkCommand[1]
                            const channel = this.discord.channels.cache.get(channelId)
                            if (channel == null) {
                                return await this.rtm.sendMessage(
                                    `Channel ${channelId} not found!`,
                                    msg.channel,
                                )
                            }
                            if (!(channel instanceof TextChannel)) {
                                return await this.rtm.sendMessage(
                                    `Channel ${channelId} is not a text channel!`,
                                    msg.channel,
                                )
                            }
                            const link = new ChannelLink()
                            link.discordId = channel.id
                            link.slackId = msg.channel
                            link.discordWebhookId = "dummy"
                            link.discordWebhookToken = "dummy"
                            await manager.insert(ChannelLink, link)
                            const webhook = await channel.createWebhook({
                                name: `Slack to Discord (${msg.channel})`,
                                reason: `Requested by ${msg.user}`,
                            })
                            if (webhook.token == null) {
                                return await this.rtm.sendMessage(
                                    `Failed to create webhook for channel ${channelId}!`,
                                    msg.channel,
                                )
                            }
                            link.discordWebhookId = webhook.id
                            link.discordWebhookToken = webhook.token
                            await manager.save(link)
                            await this.rtm.sendMessage(
                                `Linked ${channel.id} to ${msg.channel}`,
                                msg.channel,
                            )
                        })
                        return
                    }
                    await this.rtm.sendMessage(`Unknown command: ${command}`, msg.channel)
                }
                const link = await dataSource
                    .getRepository(ChannelLink)
                    .findOneBy({ slackId: msg.channel })
                if (link == null) return
                const { user } = await this.slack.users.info({ user: msg.user })
                if (user == null) return
                await this.discord.rest.post(
                    Routes.webhook(link.discordWebhookId, link.discordWebhookToken),
                    {
                        body: {
                            content: msg.text,
                            username: `${
                                user.profile?.display_name ?? user.name ?? msg.user
                            } (Slack.${msg.user})`,
                            avatar_url: user.profile?.image_512,
                        },
                        files: await Promise.all(
                            msg.files?.map(async file => {
                                return {
                                    name: file.name,
                                    contentType: file.mimetype,
                                    data: await fetch(file.url_private, {
                                        headers: {
                                            Authorization: `Bearer ${tokens.slack}`,
                                        },
                                    })
                                        .then(res => res.arrayBuffer())
                                        .then(r => Buffer.from(r)),
                                }
                            }) ?? [],
                        ),
                    },
                )
                console.log(msg_)
            })().catch(e => {
                console.error(e)
            })
        })
    }

    async start() {
        console.log("Discord: Logging in...")

        await this.discord.login(tokens.discord)
        process.on("SIGTERM", () => {
            console.log("SIGTERM received!")
            this.discord.destroy()
        })

        console.log("Slack: RTM Starting...")

        await this.rtm.start()
        process.on("SIGTERM", () => {
            void this.rtm.disconnect()
        })

        console.log("Finished!")
    }
}

const bot = new Bot()

await bot.start()

console.log("!!!")
