import { Column, Entity } from "typeorm"

@Entity("channel_links")
export class ChannelLink {
    @Column("text", { name: "slack_id", primary: true, unique: true })
    slackId!: string

    @Column("text", { name: "discord_id", primary: true, unique: true })
    discordId!: string

    @Column("text", { name: "discord_webhook_id" })
    discordWebhookId!: string

    @Column("text", { name: "discord_webhook_token" })
    discordWebhookToken!: string
}
