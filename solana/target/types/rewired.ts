/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/rewired.json`.
 */
export type Rewired = {
  "address": "6KK7zhdAuZdnom1hAEGEL4iwg66HxsKhhGXaKwDywzmU",
  "metadata": {
    "name": "rewired",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Rewired AI — On-chain student academic records"
  },
  "instructions": [
    {
      "name": "closeRecord",
      "docs": [
        "Close a data record and reclaim the rent SOL."
      ],
      "discriminator": [
        111,
        192,
        122,
        188,
        38,
        234,
        242,
        249
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "record",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "dataType",
          "type": "u8"
        },
        {
          "name": "index",
          "type": "u32"
        }
      ]
    },
    {
      "name": "createRecord",
      "docs": [
        "Create a new data record of the given type.",
        "The `index` must match the current counter for that type (prevents gaps)."
      ],
      "discriminator": [
        116,
        124,
        63,
        58,
        126,
        204,
        178,
        10
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "student",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  117,
                  100,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "student.owner",
                "account": "studentProfile"
              }
            ]
          }
        },
        {
          "name": "record",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "dataType",
          "type": "u8"
        },
        {
          "name": "index",
          "type": "u32"
        },
        {
          "name": "data",
          "type": "string"
        }
      ]
    },
    {
      "name": "initializeStudent",
      "docs": [
        "Create a new on-chain student profile.",
        "Called once when the user first links their wallet."
      ],
      "discriminator": [
        112,
        55,
        47,
        7,
        217,
        128,
        228,
        180
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "student",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  117,
                  100,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "owner",
          "type": "pubkey"
        },
        {
          "name": "fullName",
          "type": "string"
        },
        {
          "name": "email",
          "type": "string"
        }
      ]
    },
    {
      "name": "updateRecord",
      "docs": [
        "Update the JSON data of an existing record."
      ],
      "discriminator": [
        54,
        194,
        108,
        162,
        199,
        12,
        5,
        60
      ],
      "accounts": [
        {
          "name": "payer",
          "signer": true
        },
        {
          "name": "record",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "dataType",
          "type": "u8"
        },
        {
          "name": "index",
          "type": "u32"
        },
        {
          "name": "data",
          "type": "string"
        }
      ]
    },
    {
      "name": "updateStudent",
      "docs": [
        "Update the student profile fields."
      ],
      "discriminator": [
        208,
        104,
        170,
        157,
        94,
        249,
        7,
        125
      ],
      "accounts": [
        {
          "name": "payer",
          "signer": true
        },
        {
          "name": "student",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  117,
                  100,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "student.owner",
                "account": "studentProfile"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "fullName",
          "type": {
            "option": "string"
          }
        },
        {
          "name": "email",
          "type": {
            "option": "string"
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "dataRecord",
      "discriminator": [
        51,
        30,
        73,
        146,
        52,
        76,
        80,
        152
      ]
    },
    {
      "name": "studentProfile",
      "discriminator": [
        185,
        172,
        160,
        26,
        178,
        113,
        216,
        235
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "stringTooLong",
      "msg": "String exceeds maximum allowed length"
    },
    {
      "code": 6001,
      "name": "dataTooLong",
      "msg": "Data blob exceeds maximum allowed length (4096 bytes)"
    },
    {
      "code": 6002,
      "name": "invalidDataType",
      "msg": "Invalid data type (must be 0-9)"
    },
    {
      "code": 6003,
      "name": "invalidIndex",
      "msg": "Record index does not match the expected counter value"
    },
    {
      "code": 6004,
      "name": "unauthorized",
      "msg": "Unauthorized operation"
    }
  ],
  "types": [
    {
      "name": "dataRecord",
      "docs": [
        "Generic data record — stores any data type as a JSON string.",
        "PDA seeds: [data_type_byte, owner_pubkey, index_le_bytes]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "docs": [
              "The user's wallet public key (matches StudentProfile.owner)"
            ],
            "type": "pubkey"
          },
          {
            "name": "dataType",
            "docs": [
              "Data type identifier (0-9, see constants.rs)"
            ],
            "type": "u8"
          },
          {
            "name": "index",
            "docs": [
              "Sequential index within this data type for this user"
            ],
            "type": "u32"
          },
          {
            "name": "data",
            "docs": [
              "JSON-serialized data blob (max 4096 bytes)"
            ],
            "type": "string"
          },
          {
            "name": "createdAt",
            "docs": [
              "Unix timestamp of record creation"
            ],
            "type": "i64"
          },
          {
            "name": "updatedAt",
            "docs": [
              "Unix timestamp of last update"
            ],
            "type": "i64"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump seed"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "studentProfile",
      "docs": [
        "Student profile — one per wallet address.",
        "Stores identity info and per-type counters used to derive record PDAs."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "docs": [
              "The user's wallet public key (used in PDA seeds)"
            ],
            "type": "pubkey"
          },
          {
            "name": "fullName",
            "docs": [
              "Display name"
            ],
            "type": "string"
          },
          {
            "name": "email",
            "docs": [
              "Email address"
            ],
            "type": "string"
          },
          {
            "name": "counters",
            "docs": [
              "Per-data-type counters: [course, assignment, grade, study_block,",
              "chat, email, nudge, mood, memory, activity]",
              "Each counter is incremented when a new record of that type is created."
            ],
            "type": {
              "array": [
                "u32",
                10
              ]
            }
          },
          {
            "name": "createdAt",
            "docs": [
              "Unix timestamp of profile creation"
            ],
            "type": "i64"
          },
          {
            "name": "updatedAt",
            "docs": [
              "Unix timestamp of last update"
            ],
            "type": "i64"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump seed"
            ],
            "type": "u8"
          }
        ]
      }
    }
  ]
};
