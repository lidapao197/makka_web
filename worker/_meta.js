/* 由 npm run build 自动生成（读取 lib/*.js 的 WidgetMetadata），请勿手改 */
export const META = {
  "modules": [
    {
      "id": "anime",
      "label": "番剧",
      "desc": "二次元全境聚合",
      "originTitle": "🌸 动漫全境聚合",
      "source": "MakkaPakka-ALL.js",
      "versionSource": "MakkaPakka-ALL.js",
      "version": "1.4.0",
      "cacheDuration": 3600,
      "paramCount": 15,
      "params": [
        {
          "name": "anime_source",
          "title": "选择数据源",
          "value": "cal",
          "options": [
            {
              "title": "Bangumi 追番日历",
              "value": "cal"
            },
            {
              "title": "Bilibili 热度榜单",
              "value": "bili"
            },
            {
              "title": "Bangumi 近期热门",
              "value": "hot"
            },
            {
              "title": "Bangumi 年季度榜",
              "value": "rank"
            },
            {
              "title": "Bangumi 每日放送",
              "value": "daily"
            },
            {
              "title": "TMDB 热门/新番",
              "value": "tmdb"
            },
            {
              "title": "AniList 流行榜单",
              "value": "anilist"
            },
            {
              "title": "MAL 权威榜单",
              "value": "mal"
            }
          ],
          "belongTo": null,
          "ui": "pills"
        },
        {
          "name": "cal_day",
          "title": "选择日期",
          "value": "today",
          "options": [
            {
              "title": "📅 今日更新",
              "value": "today"
            },
            {
              "title": "周一 (月)",
              "value": "1"
            },
            {
              "title": "周二 (火)",
              "value": "2"
            },
            {
              "title": "周三 (水)",
              "value": "3"
            },
            {
              "title": "周四 (木)",
              "value": "4"
            },
            {
              "title": "周五 (金)",
              "value": "5"
            },
            {
              "title": "周六 (土)",
              "value": "6"
            },
            {
              "title": "周日 (日)",
              "value": "7"
            }
          ],
          "belongTo": {
            "name": "anime_source",
            "values": [
              "cal"
            ]
          },
          "ui": "pills"
        },
        {
          "name": "bili_sort",
          "title": "榜单分区",
          "value": "1",
          "options": [
            {
              "title": "📺 B站番剧 (日漫)",
              "value": "1"
            },
            {
              "title": "🇨🇳 B站国创 (国漫)",
              "value": "4"
            }
          ],
          "belongTo": {
            "name": "anime_source",
            "values": [
              "bili"
            ]
          },
          "ui": "pills"
        },
        {
          "name": "hot_cat",
          "title": "分类",
          "value": "anime",
          "options": [
            {
              "title": "动画",
              "value": "anime"
            }
          ],
          "belongTo": {
            "name": "anime_source",
            "values": [
              "hot"
            ]
          },
          "ui": "pills"
        },
        {
          "name": "rank_cat",
          "title": "分类",
          "value": "anime",
          "options": [
            {
              "title": "动画",
              "value": "anime"
            },
            {
              "title": "三次元",
              "value": "real"
            }
          ],
          "belongTo": {
            "name": "anime_source",
            "values": [
              "rank"
            ]
          },
          "ui": "pills"
        },
        {
          "name": "rank_year",
          "title": "年份",
          "value": "2026",
          "options": [
            {
              "title": "2027",
              "value": "2027"
            },
            {
              "title": "2026",
              "value": "2026"
            },
            {
              "title": "2025",
              "value": "2025"
            },
            {
              "title": "2024",
              "value": "2024"
            },
            {
              "title": "2023",
              "value": "2023"
            },
            {
              "title": "2022",
              "value": "2022"
            },
            {
              "title": "2021",
              "value": "2021"
            },
            {
              "title": "2020",
              "value": "2020"
            },
            {
              "title": "2019",
              "value": "2019"
            },
            {
              "title": "2018",
              "value": "2018"
            }
          ],
          "belongTo": {
            "name": "anime_source",
            "values": [
              "rank"
            ]
          },
          "ui": "pills"
        },
        {
          "name": "rank_month",
          "title": "月份/季度",
          "value": "all",
          "options": [
            {
              "title": "全年",
              "value": "all"
            },
            {
              "title": "冬季 (1月)",
              "value": "1"
            },
            {
              "title": "春季 (4月)",
              "value": "4"
            },
            {
              "title": "夏季 (7月)",
              "value": "7"
            },
            {
              "title": "秋季 (10月)",
              "value": "10"
            }
          ],
          "belongTo": {
            "name": "anime_source",
            "values": [
              "rank"
            ]
          },
          "ui": "pills"
        },
        {
          "name": "rank_sort",
          "title": "排序方式",
          "value": "collects",
          "options": [
            {
              "title": "排名",
              "value": "rank"
            },
            {
              "title": "热度",
              "value": "trends"
            },
            {
              "title": "收藏数",
              "value": "collects"
            },
            {
              "title": "发售日期",
              "value": "date"
            },
            {
              "title": "名称",
              "value": "title"
            }
          ],
          "belongTo": {
            "name": "anime_source",
            "values": [
              "rank"
            ]
          },
          "ui": "pills"
        },
        {
          "name": "daily_filter",
          "title": "筛选范围",
          "value": "today",
          "options": [
            {
              "title": "今日放送",
              "value": "today"
            },
            {
              "title": "指定单日",
              "value": "specific_day"
            },
            {
              "title": "本周一至四",
              "value": "mon_thu"
            },
            {
              "title": "本周五至日",
              "value": "fri_sun"
            },
            {
              "title": "整周放送",
              "value": "all_week"
            }
          ],
          "belongTo": {
            "name": "anime_source",
            "values": [
              "daily"
            ]
          },
          "ui": "pills"
        },
        {
          "name": "daily_weekday",
          "title": "指定单日星期",
          "value": "1",
          "options": [
            {
              "title": "星期一",
              "value": "1"
            },
            {
              "title": "星期二",
              "value": "2"
            },
            {
              "title": "星期三",
              "value": "3"
            },
            {
              "title": "星期四",
              "value": "4"
            },
            {
              "title": "星期五",
              "value": "5"
            },
            {
              "title": "星期六",
              "value": "6"
            },
            {
              "title": "星期日",
              "value": "7"
            }
          ],
          "belongTo": {
            "name": "anime_source",
            "values": [
              "daily"
            ]
          },
          "ui": "pills"
        },
        {
          "name": "daily_sort",
          "title": "排序方式",
          "value": "popularity_rat_bgm",
          "options": [
            {
              "title": "热度(评分人数)",
              "value": "popularity_rat_bgm"
            },
            {
              "title": "评分",
              "value": "score_bgm_desc"
            },
            {
              "title": "放送日(更新日期)",
              "value": "airdate_desc"
            },
            {
              "title": "默认",
              "value": "default"
            }
          ],
          "belongTo": {
            "name": "anime_source",
            "values": [
              "daily"
            ]
          },
          "ui": "pills"
        },
        {
          "name": "tmdb_sort",
          "title": "榜单类型",
          "value": "trending",
          "options": [
            {
              "title": "🔥 实时流行 (Trending)",
              "value": "trending"
            },
            {
              "title": "📅 最新首播 (New)",
              "value": "new"
            },
            {
              "title": "👑 高分神作 (Top Rated)",
              "value": "top"
            }
          ],
          "belongTo": {
            "name": "anime_source",
            "values": [
              "tmdb"
            ]
          },
          "ui": "pills"
        },
        {
          "name": "anilist_sort",
          "title": "排序方式",
          "value": "TRENDING_DESC",
          "options": [
            {
              "title": "📈 近期趋势 (Trending)",
              "value": "TRENDING_DESC"
            },
            {
              "title": "💖 历史人气 (Popularity)",
              "value": "POPULARITY_DESC"
            },
            {
              "title": "⭐ 评分最高 (Score)",
              "value": "SCORE_DESC"
            }
          ],
          "belongTo": {
            "name": "anime_source",
            "values": [
              "anilist"
            ]
          },
          "ui": "pills"
        },
        {
          "name": "mal_sort",
          "title": "榜单类型",
          "value": "airing",
          "options": [
            {
              "title": "🔥 当前热播 Top",
              "value": "airing"
            },
            {
              "title": "🏆 历史总榜 Top",
              "value": "all"
            },
            {
              "title": "🎥 最佳剧场版",
              "value": "movie"
            },
            {
              "title": "🔜 即将上映",
              "value": "upcoming"
            }
          ],
          "belongTo": {
            "name": "anime_source",
            "values": [
              "mal"
            ]
          },
          "ui": "pills"
        }
      ],
      "defaults": {
        "anime_source": "cal",
        "cal_day": "today",
        "bili_sort": "1",
        "hot_cat": "anime",
        "rank_cat": "anime",
        "rank_year": "2026",
        "rank_month": "all",
        "rank_sort": "collects",
        "daily_filter": "today",
        "daily_weekday": "1",
        "daily_sort": "popularity_rat_bgm",
        "tmdb_sort": "trending",
        "anilist_sort": "TRENDING_DESC",
        "mal_sort": "airing"
      }
    },
    {
      "id": "genreRank",
      "label": "全球影剧",
      "desc": "电影 · 剧集 · 题材",
      "originTitle": "🏷️ 全球影剧类别",
      "source": "MakkaPakka-ALL.js",
      "versionSource": "MakkaPakka-ALL.js",
      "version": "1.4.0",
      "cacheDuration": 3600,
      "paramCount": 5,
      "params": [
        {
          "name": "sort_by",
          "title": "影视类型",
          "value": "all",
          "options": [
            {
              "title": "🌟 全部 (影+剧混合)",
              "value": "all"
            },
            {
              "title": "🎬 电影 (Movie)",
              "value": "movie"
            },
            {
              "title": "📺 电视剧 (TV)",
              "value": "tv"
            }
          ],
          "belongTo": null,
          "ui": "pills"
        },
        {
          "name": "genre",
          "title": "题材流派",
          "value": "all",
          "options": [
            {
              "title": "🌟 全部题材 (All)",
              "value": "all"
            },
            {
              "title": "🛸 科幻 (Sci-Fi)",
              "value": "scifi"
            },
            {
              "title": "🔍 悬疑 (Mystery)",
              "value": "mystery"
            },
            {
              "title": "👻 恐怖 (Horror)",
              "value": "horror"
            },
            {
              "title": "🔪 犯罪 (Crime)",
              "value": "crime"
            },
            {
              "title": "💥 动作 (Action)",
              "value": "action"
            },
            {
              "title": "😂 喜剧 (Comedy)",
              "value": "comedy"
            },
            {
              "title": "❤️ 爱情 (Romance)",
              "value": "romance"
            },
            {
              "title": "🎭 剧情 (Drama)",
              "value": "drama"
            },
            {
              "title": "🐉 奇幻 (Fantasy)",
              "value": "fantasy"
            },
            {
              "title": "🎨 动画 (Animation)",
              "value": "animation"
            },
            {
              "title": "🎥 纪录片 (Documentary)",
              "value": "documentary"
            }
          ],
          "belongTo": null,
          "ui": "pills"
        },
        {
          "name": "region",
          "title": "国家/地区",
          "value": "all",
          "options": [
            {
              "title": "🌍 全球 (所有国家)",
              "value": "all"
            },
            {
              "title": "🇨🇳 中国大陆",
              "value": "cn"
            },
            {
              "title": "🇭🇰 中国香港",
              "value": "hk"
            },
            {
              "title": "🇹🇼 中国台湾",
              "value": "tw"
            },
            {
              "title": "🏮 港台 (香港+台湾)",
              "value": "hktw"
            },
            {
              "title": "🇯🇵 日本",
              "value": "jp"
            },
            {
              "title": "🇰🇷 韩国",
              "value": "kr"
            },
            {
              "title": "🌸 日韩合集",
              "value": "jpkr"
            },
            {
              "title": "🇹🇭 泰国",
              "value": "th"
            },
            {
              "title": "🇸🇬 新加坡",
              "value": "sg"
            },
            {
              "title": "🇲🇾 马来西亚",
              "value": "my"
            },
            {
              "title": "🇮🇳 印度",
              "value": "in"
            },
            {
              "title": "🌏 亚太大区",
              "value": "apac"
            },
            {
              "title": "🇺🇸 美国",
              "value": "us"
            },
            {
              "title": "🇬🇧 英国",
              "value": "gb"
            },
            {
              "title": "🇩🇪 德国",
              "value": "de"
            },
            {
              "title": "🇸🇪 瑞典",
              "value": "se"
            },
            {
              "title": "🇪🇺 欧洲全境",
              "value": "europe"
            },
            {
              "title": "🇪🇸 西班牙",
              "value": "es"
            },
            {
              "title": "🇲🇽 墨西哥",
              "value": "mx"
            },
            {
              "title": "💃 西语/拉丁美洲",
              "value": "latin"
            }
          ],
          "belongTo": null,
          "ui": "select"
        },
        {
          "name": "order_rule",
          "title": "排序规则",
          "value": "time",
          "options": [
            {
              "title": "📅 最新上线",
              "value": "time"
            },
            {
              "title": "🔥 热门趋势",
              "value": "popularity"
            },
            {
              "title": "⭐ 评分最高",
              "value": "rating"
            }
          ],
          "belongTo": null,
          "ui": "pills"
        }
      ],
      "defaults": {
        "sort_by": "all",
        "genre": "all",
        "region": "all",
        "order_rule": "time"
      }
    },
    {
      "id": "platform",
      "label": "平台片库",
      "desc": "按流媒体平台浏览",
      "originTitle": "🔀 平台分流片库",
      "source": "MakkaPakka-ALL.js",
      "versionSource": "ptjc.js",
      "version": "1.3.0",
      "cacheDuration": 3600,
      "paramCount": 4,
      "params": [
        {
          "name": "sort_by",
          "title": "内容分类",
          "value": "tv_drama",
          "options": [
            {
              "title": "📺 电视剧",
              "value": "tv_drama"
            },
            {
              "title": "🎤 综艺",
              "value": "tv_variety"
            },
            {
              "title": "🐲 动漫",
              "value": "tv_anime"
            },
            {
              "title": "🎬 电影",
              "value": "movie"
            }
          ],
          "belongTo": null,
          "ui": "pills"
        },
        {
          "name": "platform",
          "title": "播出平台",
          "value": "2007",
          "options": [
            {
              "title": "腾讯视频",
              "value": "2007"
            },
            {
              "title": "爱奇艺",
              "value": "1330"
            },
            {
              "title": "优酷",
              "value": "1419"
            },
            {
              "title": "芒果TV",
              "value": "1631"
            },
            {
              "title": "Bilibili",
              "value": "1605"
            },
            {
              "title": "Netflix",
              "value": "213"
            },
            {
              "title": "Disney+",
              "value": "2739"
            },
            {
              "title": "HBO",
              "value": "49"
            },
            {
              "title": "Apple TV+",
              "value": "2552"
            }
          ],
          "belongTo": null,
          "ui": "pills"
        },
        {
          "name": "sort",
          "title": "排序",
          "value": "first_air_date.desc",
          "options": [
            {
              "title": "📅 最新首播",
              "value": "first_air_date.desc"
            },
            {
              "title": "🔥 热度最高",
              "value": "popularity.desc"
            },
            {
              "title": "⭐ 评分最高",
              "value": "vote_average.desc"
            }
          ],
          "belongTo": null,
          "ui": "pills"
        }
      ],
      "defaults": {
        "sort_by": "tv_drama",
        "platform": "2007",
        "sort": "first_air_date.desc"
      }
    }
  ],
  "quick": [
    {
      "label": "豆瓣热榜",
      "originTitle": "豆瓣熱榜",
      "description": "豆瓣實時熱門影劇綜",
      "module": "genreRank",
      "params": {
        "sort_by": "all",
        "genre": "drama",
        "region": "cn",
        "order_rule": "popularity"
      }
    },
    {
      "label": "各平台剧场",
      "originTitle": "各平臺劇場",
      "description": "網路平臺劇場榜單",
      "module": "platform",
      "params": {
        "sort_by": "tv_drama",
        "platform": "2007",
        "sort": "popularity.desc"
      }
    },
    {
      "label": "热门番剧",
      "originTitle": "熱門番劇",
      "description": "Bangumi 實時熱榜",
      "module": "anime",
      "params": {
        "anime_source": "bili",
        "bili_sort": "1"
      }
    },
    {
      "label": "芒果TV热榜",
      "originTitle": "芒果TV熱榜",
      "description": "最新芒果TV熱播劇集與綜藝",
      "module": "platform",
      "params": {
        "sort_by": "tv_variety",
        "platform": "1631",
        "sort": "first_air_date.desc"
      }
    },
    {
      "label": "流媒体 TOP 10",
      "originTitle": "流媒體 TOP 10",
      "description": "FlixPatrol 全球與主要地區榜單",
      "module": "platform",
      "params": {
        "sort_by": "movie",
        "platform": "213",
        "sort": "popularity.desc"
      }
    }
  ],
  "defaults": {
    "anime": {
      "anime_source": "cal",
      "cal_day": "today",
      "bili_sort": "1",
      "hot_cat": "anime",
      "rank_cat": "anime",
      "rank_year": "2026",
      "rank_month": "all",
      "rank_sort": "collects",
      "daily_filter": "today",
      "daily_weekday": "1",
      "daily_sort": "popularity_rat_bgm",
      "tmdb_sort": "trending",
      "anilist_sort": "TRENDING_DESC",
      "mal_sort": "airing"
    },
    "genreRank": {
      "sort_by": "all",
      "genre": "all",
      "region": "all",
      "order_rule": "time"
    },
    "platform": {
      "sort_by": "tv_drama",
      "platform": "2007",
      "sort": "first_air_date.desc"
    }
  },
  "genreMap": {
    "12": "冒险",
    "14": "奇幻",
    "16": "动画",
    "18": "剧情",
    "27": "恐怖",
    "28": "动作",
    "35": "喜剧",
    "36": "历史",
    "37": "西部",
    "53": "惊悚",
    "80": "犯罪",
    "99": "纪录片",
    "878": "科幻",
    "9648": "悬疑",
    "10402": "音乐",
    "10749": "爱情",
    "10751": "家庭",
    "10752": "战争",
    "10759": "动作冒险",
    "10762": "儿童",
    "10763": "新闻",
    "10764": "真人秀",
    "10765": "科幻奇幻",
    "10766": "肥皂剧",
    "10767": "脱口秀",
    "10768": "战综",
    "10770": "电视电影"
  },
  "advancedGenreMap": {
    "all": {
      "movie": "",
      "tv": ""
    },
    "scifi": {
      "movie": "878",
      "tv": "10765"
    },
    "mystery": {
      "movie": "9648",
      "tv": "9648"
    },
    "horror": {
      "movie": "27",
      "tv": "27"
    },
    "crime": {
      "movie": "80",
      "tv": "80"
    },
    "action": {
      "movie": "28",
      "tv": "10759"
    },
    "comedy": {
      "movie": "35",
      "tv": "35"
    },
    "romance": {
      "movie": "10749",
      "tv": "10749"
    },
    "drama": {
      "movie": "18",
      "tv": "18"
    },
    "fantasy": {
      "movie": "14",
      "tv": "10765"
    },
    "animation": {
      "movie": "16",
      "tv": "16"
    },
    "documentary": {
      "movie": "99",
      "tv": "99"
    }
  },
  "regionMap": {
    "all": "",
    "cn": "CN",
    "hk": "HK",
    "tw": "TW",
    "hktw": "HK|TW",
    "jp": "JP",
    "kr": "KR",
    "jpkr": "JP|KR",
    "th": "TH",
    "sg": "SG",
    "my": "MY",
    "in": "IN",
    "apac": "CN|HK|TW|JP|KR|TH|SG|MY|IN",
    "us": "US",
    "gb": "GB",
    "de": "DE",
    "se": "SE",
    "europe": "GB|DE|FR|IT|ES|SE|NO|DK|FI|NL|BE|CH|AT|IE",
    "es": "ES",
    "mx": "MX",
    "latin": "ES|MX|AR|CO|CL|PE|VE"
  },
  "sourceVersions": {
    "MakkaPakka-ALL.js": "1.4.0",
    "ptjc.js": "1.3.0"
  },
  "primaryVersion": "1.4.0",
  "appVersion": "1.0.0"
};
