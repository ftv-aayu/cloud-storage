// Official Genshin Impact in-game chat stickers
// Source: https://genshin-impact.fandom.com/wiki/Chat/Gallery
// These are served directly from the Genshin wiki CDN

const WIKI = "https://static.wikia.nocookie.net/gensin-impact/images";

// Each sticker: { id, label, url }
// URLs are the direct image links from the wiki gallery
export const GENSHIN_STICKERS = [
    // ── Set 1 (Paimon) ────────────────────────────────────────────────────────
    { id: "g_no_problem",   label: "No problem!",   url: "https://rerollcdn.com/GENSHIN/Stickers/1.png" },
    { id: "g_ship_out",     label: "Ship out!",     url: "https://rerollcdn.com/GENSHIN/Stickers/2.png" },
    { id: "g_time_to_eat",  label: "Time to eat!",  url: "https://rerollcdn.com/GENSHIN/Stickers/3.png" },
    { id: "g_surprised",    label: "Surprised!",    url: "https://rerollcdn.com/GENSHIN/Stickers/4.png" },
    { id: "g_too_easy",     label: "Too easy!",     url: "https://rerollcdn.com/GENSHIN/Stickers/5.png" },
    { id: "g_noooo",        label: "Noooo!",        url: "https://rerollcdn.com/GENSHIN/Stickers/6.png" },
    { id: "g_oh",           label: "Oh...",         url: "https://rerollcdn.com/GENSHIN/Stickers/7.png" },
    { id: "g_well_done",    label: "Well done!",    url: "https://rerollcdn.com/GENSHIN/Stickers/8.png" },
    { id: "g_save_me",      label: "Save me!",      url: "https://rerollcdn.com/GENSHIN/Stickers/9.png" },
    { id: "g_funny",        label: "That's funny!", url: "https://rerollcdn.com/GENSHIN/Stickers/10.png" },
    { id: "g_outta_way",    label: "Outta my way!", url: "https://rerollcdn.com/GENSHIN/Stickers/11.png" },
    { id: "g_asleep",       label: "Fall asleep",   url: "https://rerollcdn.com/GENSHIN/Stickers/12.png" },
    { id: "g_please",       label: "Please~",       url: "https://rerollcdn.com/GENSHIN/Stickers/13.png" },
    { id: "g_alert",        label: "Alert",         url: "https://rerollcdn.com/GENSHIN/Stickers/14.png" },
    { id: "g_mora",         label: "Will 1 Mora do?",url:"https://rerollcdn.com/GENSHIN/Stickers/15.png" },
    // ── Set 2 ─────────────────────────────────────────────────────────────────
    { id: "g_ok",           label: "OK",            url: "https://rerollcdn.com/GENSHIN/Stickers/16.png" },
    { id: "g_be_good",      label: "I'll be good",  url: "https://rerollcdn.com/GENSHIN/Stickers/17.png" },
    { id: "g_shame",        label: "Shame",         url: "https://rerollcdn.com/GENSHIN/Stickers/18.png" },
    { id: "g_love",         label: "Love",          url: "https://rerollcdn.com/GENSHIN/Stickers/19.png" },
    { id: "g_hehe",         label: "Hehe",          url: "https://rerollcdn.com/GENSHIN/Stickers/20.png" },
    { id: "g_good_night",   label: "Good Night",    url: "https://rerollcdn.com/GENSHIN/Stickers/21.png" },
    { id: "g_fallen",       label: "Fallen",        url: "https://rerollcdn.com/GENSHIN/Stickers/22.png" },
    { id: "g_observing",    label: "Secretly observing", url: "https://rerollcdn.com/GENSHIN/Stickers/23.png" },
    { id: "g_oh2",          label: "Oh!",           url: "https://rerollcdn.com/GENSHIN/Stickers/24.png" },
    { id: "g_expectant",    label: "Expectant",     url: "https://rerollcdn.com/GENSHIN/Stickers/25.png" },
    { id: "g_shocked",      label: "Shocked",       url: "https://rerollcdn.com/GENSHIN/Stickers/26.png" },
    { id: "g_idea",         label: "I have an idea!",url:"https://rerollcdn.com/GENSHIN/Stickers/27.png" },
    { id: "g_petals",       label: "Falling petals",url: "https://rerollcdn.com/GENSHIN/Stickers/28.png" },
    { id: "g_applause",     label: "Applause",      url: "https://rerollcdn.com/GENSHIN/Stickers/29.png" },
    // ── Set 3 ─────────────────────────────────────────────────────────────────
    { id: "g_sip_tea",      label: "Sipping tea",   url: "https://rerollcdn.com/GENSHIN/Stickers/30.png" },
    { id: "g_take_all",     label: "I'll take them all", url: "https://rerollcdn.com/GENSHIN/Stickers/31.png" },
    { id: "g_thinking",     label: "Thinking",      url: "https://rerollcdn.com/GENSHIN/Stickers/32.png" },
    { id: "g_spread",       label: "Spread hands",  url: "https://rerollcdn.com/GENSHIN/Stickers/33.png" },
    { id: "g_sigh",         label: "Sigh",          url: "https://rerollcdn.com/GENSHIN/Stickers/34.png" },
    { id: "g_pleased",      label: "Pleased",       url: "https://rerollcdn.com/GENSHIN/Stickers/35.png" },
    { id: "g_irritable",    label: "Irritable",     url: "https://rerollcdn.com/GENSHIN/Stickers/36.png" },
    { id: "g_fearsome",     label: "Fearsome",      url: "https://rerollcdn.com/GENSHIN/Stickers/37.png" },
    { id: "g_proud",        label: "Proud",         url: "https://rerollcdn.com/GENSHIN/Stickers/38.png" },
    { id: "g_heating_up",   label: "I'm heating up!",url:"https://rerollcdn.com/GENSHIN/Stickers/39.png" },
    { id: "g_annoying",     label: "So annoying!",  url: "https://rerollcdn.com/GENSHIN/Stickers/40.png" },
    { id: "g_mad",          label: "Mad",           url: "https://rerollcdn.com/GENSHIN/Stickers/41.png" },
    { id: "g_refuse",       label: "I refuse.",     url: "https://rerollcdn.com/GENSHIN/Stickers/42.png" },
    { id: "g_hungry",       label: "So hungry...",  url: "https://rerollcdn.com/GENSHIN/Stickers/43.png" },
    { id: "g_mora2",        label: "Mora!",         url: "https://rerollcdn.com/GENSHIN/Stickers/44.png" },
    // ── Set 4 ─────────────────────────────────────────────────────────────────
    { id: "g_flowers",      label: "Have some flowers", url: "https://rerollcdn.com/GENSHIN/Stickers/45.png" },
    { id: "g_nothing",      label: "It was nothing",url: "https://rerollcdn.com/GENSHIN/Stickers/46.png" },
    { id: "g_what_happened",label: "What happened?",url: "https://rerollcdn.com/GENSHIN/Stickers/47.png" },
    { id: "g_cold",         label: "Cold",          url: "https://rerollcdn.com/GENSHIN/Stickers/48.png" },
    { id: "g_snoozing",     label: "Snoozing",      url: "https://rerollcdn.com/GENSHIN/Stickers/49.png" },
    { id: "g_no_touching",  label: "No touching!",  url: "https://rerollcdn.com/GENSHIN/Stickers/50.png" },
    { id: "g_upset",        label: "Upset",         url: "https://rerollcdn.com/GENSHIN/Stickers/51.png" },
    { id: "g_not_bad",      label: "Not bad",       url: "https://rerollcdn.com/GENSHIN/Stickers/52.png" },
    { id: "g_pray",         label: "Pray",          url: "https://rerollcdn.com/GENSHIN/Stickers/53.png" },
    { id: "g_good_morning", label: "Good Morning",  url: "https://rerollcdn.com/GENSHIN/Stickers/54.png" },
    { id: "g_you_can",      label: "You can do it!",url: "https://rerollcdn.com/GENSHIN/Stickers/55.png" },
    { id: "g_recording",    label: "Recording",     url: "https://rerollcdn.com/GENSHIN/Stickers/56.png" },
    { id: "g_shocked2",     label: "Shocked",       url: "https://rerollcdn.com/GENSHIN/Stickers/57.png" },
    { id: "g_light_fades",  label: "The light fades",url:"https://rerollcdn.com/GENSHIN/Stickers/58.png" },
    { id: "g_not_at_all",   label: "Not at all!",   url: "https://rerollcdn.com/GENSHIN/Stickers/59.png" },
];

export default GENSHIN_STICKERS;
