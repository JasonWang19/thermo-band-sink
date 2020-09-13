# ADR Decisoin on Organization Structure
The organization structure is based on the following tables/collections
## orgs 
`orgs` table/collection contains information regarding organization basic information including
* `orgId` org id
* `orgName` org name
* `detail` org detail: information of address, contact info etc.
* `leaves` leaves (end user) of the org
* `teams` all of the teams belong to the org
``` json
{
    "_id": {
        "$oid": "5ee80e9121fe66ea4b902909"
    },
    "orgId": "org-00010",
    "detail": {
        "address": "河北省石家中华区",
        "phone": "13488888899"
    },
    "orgName": "河北省石家庄中华区土牛小学",
    "leaves": {
        "student-00059": {
            "c": "student-00059",
            "name": "许仙",
            "team": "d4a3c9e2-c3a6-4f8e-a022-98907836592f"
        },
        "student-00060": {
            "c": "student-00060",
            "name": "大头",
            "team": "",
        }
    },
    "teams": [{
        "levels": ["1", "1"],
        "id": "9385fa07-304f-45e3-9ab5-70210dca8f6f",
        "members": ["student-00054"]
    }, {
        "levels": ["1", "2"],
        "id": "bfd22d21-ece7-4367-8836-56acb4d2f9c8",
        "members": ["student-00053", "student-00055"]
    }]
}
```
## org_structs
`org_structs` table/collection contains relationships between different staff. 
* `orgId` and `staffId` combined to determine the staff
* `inferiors` array of inferiors
* `superiors` array of superiors
* `leaves` array of leaves not already in the teams
* `teams` array of teams managed by the staff
* `name` name of the staff

```json
{
    "_id": {
        "$oid": "5ef02fa521fe66ea4b90f695"
    },
    "orgId": "org-00010",
    "staffId": "staff-00112",
    "inferiors": ["staff-00113"],
    "leaves": [],
    "superiors": ["staff-00111"],
    "teams": ["56212ae2-dae3-448a-9589-5b094fdc075f", "c7550824-d412-466c-a074-541f2d0efa87"],
    "name": "小强",
    "detail": {
        "phone": "11111"
    }
}
```

## staffs

`staffs` table/collection contains the default detail information of staff, the specific detail for the staff in the org can be defined in `org_structs` to override the default value.

* `staffId` unique id for the staff
* `name` staff name
* `detail`

```json
{
    "_id": {
        "$oid": "5eebec6d21fe66ea4b909abd"
    },
    "staffId": "staff-00112",
    "name": "小强",
    "detail": {
        "phone":"111",
        "email":"a@b.com",
        "homepage":"www.abc.com/def"
    },
}
```

## leaves
`orgs` already contain the information of its leaves, `leaves` table/collection is used to include the detailed information of the leaf and to query for leaf. It has redundent information on name and orgId.

```json
{
    "c": "student-00059",
    "name": "许仙",
    "orgId": "org-00010",
    "detail": {
        "email": "student@abc.com"
    }
}
```

## devices
`devices` table/collection has records of devices. Main purpose of it are:
* devices can be assigned to org, so devices may have org id
* devices can be linked to the leaf, so devices may have leaf id

```json
{
    "deviceName": "KB2020-0001",
    "c": "student-00011",
    "orgId": "org-00010",
}
```

## device_leaf
`device_leaf` table/collection has history of relationship between devices and leaf.

```json
{
    "deviceName": "KB2020-0001",
    "c": "student-00011",
    "connTs": "2020-01-01T10:00:00Z",
    "disConnTs": "2020-01-05T10:00:00Z",
    "updateTs": "2020-01-05T10:00:00Z"
}
```