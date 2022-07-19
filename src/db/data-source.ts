import { DataSource } from "typeorm"

import { ChannelLink } from "./entities/channel-link.js"
import { CreateChannelLinkTable1658247150306 } from "./migrations/1658247150306-CreateChannelLinkTable.js"

export const dataSource = new DataSource({
    type: "better-sqlite3",
    database: "./data/store.sqlite3",
    entities: [ChannelLink],
    migrations: [CreateChannelLinkTable1658247150306],
})
