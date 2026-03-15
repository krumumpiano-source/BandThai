-- ============================================================
-- SQL Script: ลบเพลงซ้ำ (Global Library) — Safe Version
-- สร้างเมื่อ: 2026-03-15T11:38:17.287Z
-- เพลงซ้ำ (same singer): 103 กลุ่ม
-- จำนวนที่จะลบ: 107 เพลง
-- ============================================================

-- STEP 1: Redirect band_song_refs
-- (ถ้า band ใดเคย reference เพลงซ้ำ → จะถูกชี้ไปยัง KEEP แทน)
-- ============================================================
UPDATE band_song_refs
  SET song_id = '5b2427d0-1711-4fd9-872d-038ec29a47a4'
  WHERE song_id = '5891414d-a22e-436b-8dd6-e1d7a207f160';
UPDATE band_song_refs
  SET song_id = '6ba15c42-030e-429d-a1c1-ab866b76b589'
  WHERE song_id = '35acba78-153d-43c9-b42c-c9e6c672de39';
UPDATE band_song_refs
  SET song_id = 'fdb64f1b-298b-47ca-a667-740109b3164b'
  WHERE song_id = '93d89ea6-51ae-4d8a-a53f-69e9f3fdf141';
UPDATE band_song_refs
  SET song_id = 'db53a7ca-1e4d-4cfd-82de-331e8615c3b3'
  WHERE song_id = 'd14bab40-a197-4bc8-9175-15e115ba8fc5';
UPDATE band_song_refs
  SET song_id = 'b9d7250c-8b60-4b42-adba-135c01a5fa32'
  WHERE song_id = '7bee985e-9d89-4611-9584-40fbe989ffa8';
UPDATE band_song_refs
  SET song_id = '07f60b87-ac69-4b53-bcb1-b6a8bdbbbbd1'
  WHERE song_id = 'd4f82441-d738-4e31-836b-cbd7168b2c9c';
UPDATE band_song_refs
  SET song_id = 'b45a1025-4138-40fb-ba08-514c48385107'
  WHERE song_id = '9e3e6fb2-c644-4dc1-ba34-f22002672bf7';
UPDATE band_song_refs
  SET song_id = 'b45a1025-4138-40fb-ba08-514c48385107'
  WHERE song_id = 'e41064c6-6b3c-4381-8931-da7948fa05eb';
UPDATE band_song_refs
  SET song_id = '463879be-0427-413e-8f1e-c16c57de0ba1'
  WHERE song_id = '30eb0607-bbea-4e37-9ea6-868f2d95d443';
UPDATE band_song_refs
  SET song_id = '52c54bc2-939c-429b-a7f7-a1b06b2f1e69'
  WHERE song_id = 'f1e5ce03-5190-4a1f-9553-8e4116dc0bbc';
UPDATE band_song_refs
  SET song_id = '52c54bc2-939c-429b-a7f7-a1b06b2f1e69'
  WHERE song_id = 'e3ca31cf-b06a-41bb-8537-3538d9996584';
UPDATE band_song_refs
  SET song_id = 'f11fc488-06a7-43f9-a58e-a98dcbdafa40'
  WHERE song_id = '1c8c939e-ae0f-45e1-b276-af63d4645aa4';
UPDATE band_song_refs
  SET song_id = 'f11fc488-06a7-43f9-a58e-a98dcbdafa40'
  WHERE song_id = '06592cf9-7581-4138-9cbc-ca965ac0eaa5';
UPDATE band_song_refs
  SET song_id = '5e448828-70c5-424c-b3f7-3bb84e9a5d42'
  WHERE song_id = '61f4d66a-a560-4288-84ac-4f21ae4f301f';
UPDATE band_song_refs
  SET song_id = '69cd1306-0010-44ce-a003-a17a53fa6fb6'
  WHERE song_id = '506c1c52-6851-4afa-9917-8968e5644a60';
UPDATE band_song_refs
  SET song_id = 'ee7ccda5-2068-43b7-87ad-198de8a68cd1'
  WHERE song_id = '3c3a70f4-eee3-4581-8b14-d97c489b1d2a';
UPDATE band_song_refs
  SET song_id = 'ad7d7e60-599a-4a06-95df-cef3f55225eb'
  WHERE song_id = '0c8ef0c6-1704-4221-bf2a-581be79a2ce0';
UPDATE band_song_refs
  SET song_id = 'f9311ad9-6aee-4250-ac0e-5f28be5cde99'
  WHERE song_id = '4052440d-38a0-40b0-b9bb-00022d82edcb';
UPDATE band_song_refs
  SET song_id = '2619f03d-f69f-44b9-820d-f3638b884702'
  WHERE song_id = 'faaaef13-bc8c-4990-ab25-236d5c2a83ec';
UPDATE band_song_refs
  SET song_id = '799aea47-36d3-407b-a7ec-58e8dcfd6ab0'
  WHERE song_id = '97944129-daa0-43ab-b27f-c84af346b099';
UPDATE band_song_refs
  SET song_id = '805590df-b0aa-4fda-b689-6f46cd1b6955'
  WHERE song_id = '4af14a40-0862-4f68-8d59-91fd053d6188';
UPDATE band_song_refs
  SET song_id = '845f1324-6d5b-43cb-9b74-93ba40d307a9'
  WHERE song_id = '2d43ba4c-8bb0-4e7a-a1af-43777c87d2a7';
UPDATE band_song_refs
  SET song_id = '10fc8f77-f16b-401a-9ea2-59608f3b455d'
  WHERE song_id = '56f8f574-cf7a-41e4-b9f8-4448e652838a';
UPDATE band_song_refs
  SET song_id = '55157774-ada6-43a2-a169-eb4cba1f78bd'
  WHERE song_id = 'ef45c346-bdb7-4e17-899c-e30133e5b0c2';
UPDATE band_song_refs
  SET song_id = '6da79a8d-7776-4820-bb2a-8b6137817a21'
  WHERE song_id = 'd70cd0c9-b2ed-4921-ae28-7b31ec951aa0';
UPDATE band_song_refs
  SET song_id = '3b799f66-c17a-41ce-b46b-8cea0ba504d2'
  WHERE song_id = '83da4252-0b65-4d75-bc54-20d691b361af';
UPDATE band_song_refs
  SET song_id = '88c4ced1-920d-47c5-8022-01e1dd10509b'
  WHERE song_id = '1ee6491c-362b-4c10-821c-ba37d92a6495';
UPDATE band_song_refs
  SET song_id = 'e77b76e9-5df9-4fd9-8087-fff2d8e943d9'
  WHERE song_id = 'cfb53618-c506-4453-bb10-bab31dbfcb1b';
UPDATE band_song_refs
  SET song_id = 'cb5abae9-b29b-439c-8e76-1b19b8b318e0'
  WHERE song_id = 'ca115a0a-501e-49ce-a9eb-0076321f36ed';
UPDATE band_song_refs
  SET song_id = '367b496d-0e7c-4a7b-86be-42a407f7fb51'
  WHERE song_id = 'b675c406-8886-46c3-b525-2ac6175ebaec';
UPDATE band_song_refs
  SET song_id = '636c6b47-633e-4bc1-be82-da94e79c9ee7'
  WHERE song_id = 'e1d662cc-409f-484a-8990-ccc1248810d4';
UPDATE band_song_refs
  SET song_id = '0de1e8f8-03f1-47a4-89dc-d8c35931f562'
  WHERE song_id = '9f2aaaf9-ba76-4c7b-bf28-bddd2d26b20a';
UPDATE band_song_refs
  SET song_id = '86f6914e-ed56-4c8a-9691-3ab61d12d6da'
  WHERE song_id = '9d0ecd15-49a3-4380-8ee3-7901b85ad9de';
UPDATE band_song_refs
  SET song_id = 'b508b5a6-a10f-4abd-862b-739d90a17d18'
  WHERE song_id = 'fa8c1852-2991-43b5-bfef-0fa5a52b6630';
UPDATE band_song_refs
  SET song_id = '86fa308c-e603-45fc-8509-8da6b4dad3e6'
  WHERE song_id = 'e7b23734-9fbe-407e-93aa-5b761eb49595';
UPDATE band_song_refs
  SET song_id = 'd8f7f4b1-b185-4114-9af1-794086fa23d2'
  WHERE song_id = '7fb5f601-5449-450e-bf02-280b0a5d5e70';
UPDATE band_song_refs
  SET song_id = '75aabf35-08ab-4f6f-a7fb-b213ea87a87e'
  WHERE song_id = '91f8bac1-54dd-48d8-84fc-09348edff9bb';
UPDATE band_song_refs
  SET song_id = '2b7bf437-48aa-4b4b-bd7b-cf06797f9647'
  WHERE song_id = '1616aab3-2ec0-49c2-ace3-70f6ad4546a1';
UPDATE band_song_refs
  SET song_id = 'd3b65e63-3c75-4f21-9595-47ba60201a70'
  WHERE song_id = '507c4cd6-9b61-4dfa-8d6e-820c5774c9fa';
UPDATE band_song_refs
  SET song_id = 'f26037f7-7213-4059-91a2-d6fb7ecd588c'
  WHERE song_id = '1bb69315-7b07-4544-950f-08b205fabcd7';
UPDATE band_song_refs
  SET song_id = '6e0b950c-0009-4911-b3fc-afcda2669560'
  WHERE song_id = 'c3fce93d-962b-4e42-b088-8163bb723179';
UPDATE band_song_refs
  SET song_id = '5eef2a59-12b0-408a-b68c-0d1efeab5d9d'
  WHERE song_id = '4b7b6a29-0f7e-4ad5-8320-5d5d0639915e';
UPDATE band_song_refs
  SET song_id = 'e56c7bb9-a478-4daf-896c-d870e54866b7'
  WHERE song_id = '63944936-05f6-4a17-87d9-9a400119e8a8';
UPDATE band_song_refs
  SET song_id = 'f186a3b8-5fe2-43f3-9ac3-c39e1424c61a'
  WHERE song_id = '7704dce9-d0d4-494f-a8ed-af0aacdf6c6d';
UPDATE band_song_refs
  SET song_id = 'e86d135c-ee91-47c1-9ec5-1e06d195847e'
  WHERE song_id = '356576ee-57d3-4bf3-9c9c-5f4b5757d47b';
UPDATE band_song_refs
  SET song_id = '17b94a3e-327e-4363-8c5b-357e4690938c'
  WHERE song_id = '0f451c11-34dc-4ab8-a85f-d6d004f769e1';
UPDATE band_song_refs
  SET song_id = '3c4cc334-eda0-4d5b-8e30-ac0619c8d84f'
  WHERE song_id = '22041f32-fcf7-485e-839c-01d89fe581f9';
UPDATE band_song_refs
  SET song_id = '8c8235e5-3dbd-4529-8a71-22e07f426e1c'
  WHERE song_id = 'd882b530-abd2-4070-a252-642f127bee90';
UPDATE band_song_refs
  SET song_id = 'a2a6fcca-95e2-46ea-9725-f798e7d2205d'
  WHERE song_id = 'd5ebbfbd-f7af-4bf6-93c6-86ffb65af17a';
UPDATE band_song_refs
  SET song_id = '8010dbd3-e001-4b8f-8ced-f29b6a9e50ac'
  WHERE song_id = '82b55a8a-07e1-4306-9dea-22d5f7fc6e3f';
UPDATE band_song_refs
  SET song_id = 'dce47cbc-8ea2-47c9-9154-e6e30644a5fe'
  WHERE song_id = 'af6146c6-b4b3-4c9f-9373-1f9c8514d613';
UPDATE band_song_refs
  SET song_id = 'f610e981-b337-43fa-8636-4d542cd75eb2'
  WHERE song_id = 'b0b707e7-6c0e-4d7e-b4b1-62b89bcf724f';
UPDATE band_song_refs
  SET song_id = 'e33b55ec-e0a5-4b5c-bde9-99c7effa4e4e'
  WHERE song_id = '93e4e6f4-588c-4f92-8e74-bb946875d35c';
UPDATE band_song_refs
  SET song_id = '9fecdd24-9cef-47fd-a592-3edbabb5d330'
  WHERE song_id = 'b0d8c69c-a4fc-4962-86ef-0dde63401055';
UPDATE band_song_refs
  SET song_id = 'b7ea7c3a-071a-426b-aa40-e6feeacf6348'
  WHERE song_id = 'f0e60e0d-8048-450e-9d07-d3605fa9f0f9';
UPDATE band_song_refs
  SET song_id = '110ebf0e-4f6a-4fb5-9cb4-d274621eb511'
  WHERE song_id = 'f65255a8-9a99-446c-9212-6e7e3cd5fe52';
UPDATE band_song_refs
  SET song_id = '1de9b222-63ac-45b3-91b9-78791ae91657'
  WHERE song_id = '28d423ec-3c44-4ffa-9173-e3219c352858';
UPDATE band_song_refs
  SET song_id = '426fcd1d-e8e8-4768-86f1-12b6e06e9949'
  WHERE song_id = '7158f82a-f393-4309-9ba5-59b15ca6be57';
UPDATE band_song_refs
  SET song_id = '94ee75ec-b4fc-4291-b8ed-ac5ef6eace07'
  WHERE song_id = 'e783172c-eedb-4371-9b06-c0554a82b0fb';
UPDATE band_song_refs
  SET song_id = 'f3f2cfbf-c4bc-4188-ac75-4f1300a3bee3'
  WHERE song_id = '79481050-95d9-408f-9376-b570a442fdc8';
UPDATE band_song_refs
  SET song_id = 'f0884867-a9ba-4394-83c4-43493edb5102'
  WHERE song_id = '96887369-e5fd-44e6-a83e-0713e2af0c5f';
UPDATE band_song_refs
  SET song_id = '203fe279-4278-4f04-9132-531fb3d23c74'
  WHERE song_id = '6e41d348-6713-4cf4-b18b-b1ab882c49bf';
UPDATE band_song_refs
  SET song_id = '8c0a34e3-4969-433f-80b2-f5d596280aa7'
  WHERE song_id = '2a9d982d-12b8-4c17-a118-f285b4c81a02';
UPDATE band_song_refs
  SET song_id = 'a714d1c8-eb96-45c8-b2f7-9fa05af0c8bf'
  WHERE song_id = 'ca02bc79-d1f6-49be-9b84-b45569af8089';
UPDATE band_song_refs
  SET song_id = 'ef42bafc-fcb8-4d2a-ae0c-40454c407da5'
  WHERE song_id = 'fb38bd3d-c062-49f5-b78c-47afacf776c6';
UPDATE band_song_refs
  SET song_id = 'cceed5b6-3cbc-476e-a357-01cf088eb33a'
  WHERE song_id = '7138c9e0-c2d7-4533-be13-f23ef307909a';
UPDATE band_song_refs
  SET song_id = 'cceed5b6-3cbc-476e-a357-01cf088eb33a'
  WHERE song_id = 'c851da95-1633-41b6-9ca7-a47b2ab1f6e6';
UPDATE band_song_refs
  SET song_id = '35009e59-4f51-4474-a8ec-d07169878e2a'
  WHERE song_id = '27e53c38-edd7-4f0e-9eca-36430c25ad62';
UPDATE band_song_refs
  SET song_id = 'de676b67-e480-48d7-8754-2ec7e23d27d7'
  WHERE song_id = '073c0da3-5742-46c3-9af1-543175120e58';
UPDATE band_song_refs
  SET song_id = 'f8d3e3b7-c010-4551-8156-24de945fe478'
  WHERE song_id = '0b261f5e-e76e-4efa-a2e5-4b72af33ac96';
UPDATE band_song_refs
  SET song_id = '6216f1dc-b4c7-4df7-8d11-e2af0f773f74'
  WHERE song_id = '3f1a0304-c694-4840-9cf4-e3708dd39c84';
UPDATE band_song_refs
  SET song_id = 'ce0b95e3-37d8-4a92-b113-e7374388bd98'
  WHERE song_id = '0867864c-ba60-4c60-a531-93735dd13983';
UPDATE band_song_refs
  SET song_id = 'cd543950-dffc-45db-9273-a5a4985011fa'
  WHERE song_id = '59858076-f6f4-488a-91bf-9d7e93852dd6';
UPDATE band_song_refs
  SET song_id = '3a35d3d6-9be3-4a87-be21-e8b900b8421f'
  WHERE song_id = 'e5a32060-ad18-4958-a5c1-afdc3676108b';
UPDATE band_song_refs
  SET song_id = '5384047c-c59e-4f21-97df-f823e71b69c4'
  WHERE song_id = '8468d0c5-ace4-4c09-85ae-2e76ee044cd9';
UPDATE band_song_refs
  SET song_id = '133cfdf6-95ad-4ff3-82e8-96ba2e724489'
  WHERE song_id = 'db251469-9e7b-4445-b4cb-e0d9ff79c4f1';
UPDATE band_song_refs
  SET song_id = '095d0160-9fa3-4d6f-b200-5202305d48ae'
  WHERE song_id = 'a1fc9e20-0811-4b94-bdb4-f0223f4a1940';
UPDATE band_song_refs
  SET song_id = '343870b7-7cf1-4715-bbfb-31b64d79a97c'
  WHERE song_id = 'fd531cdd-1bd7-4311-a5b0-083cd3e214a1';
UPDATE band_song_refs
  SET song_id = 'c582881f-f2f1-4265-8963-22a280b88e67'
  WHERE song_id = '2477f4fe-063f-400a-a8c6-6046da917441';
UPDATE band_song_refs
  SET song_id = 'bec9bc1e-a3d2-46d0-9524-d386ebc091ad'
  WHERE song_id = 'd16bfac2-1e73-4cc6-94f9-01c71708e143';
UPDATE band_song_refs
  SET song_id = '9432264a-ac2f-4e25-a2a7-84cfa8ba995b'
  WHERE song_id = '6f48f001-a6c4-43e8-a718-301a5f8c296e';
UPDATE band_song_refs
  SET song_id = 'edf7d30e-2b42-4398-8483-1558aed28479'
  WHERE song_id = '3d0c3520-bd56-433e-b45d-c0613a0310fa';
UPDATE band_song_refs
  SET song_id = '38ee01c3-5a25-4943-b2b9-4bad8abc20db'
  WHERE song_id = '52fd8b40-4107-4ba8-bfff-d1f6fbdeee61';
UPDATE band_song_refs
  SET song_id = 'cc483119-70f2-4697-85fc-5deafaa43159'
  WHERE song_id = '959619ef-f4ca-41c9-85b4-98a280ac5462';
UPDATE band_song_refs
  SET song_id = 'ad95491e-5cdd-4844-a232-ac05a0b646e7'
  WHERE song_id = '844f6089-58dc-403f-b9a9-7b20e7015622';
UPDATE band_song_refs
  SET song_id = 'e45e118b-4457-4df4-9470-373bb209c8fb'
  WHERE song_id = '2e00eb55-9e73-42de-b4f3-8f412fe53d2c';
UPDATE band_song_refs
  SET song_id = 'db3f62da-4efa-4808-b41a-66c79ed497f8'
  WHERE song_id = 'a46ad867-6c4f-4754-85ec-6e81c3073280';
UPDATE band_song_refs
  SET song_id = '5c4dff9e-b7ba-43f1-936d-0a043289096d'
  WHERE song_id = '61322633-2a8f-4c71-b9af-8efee10ec65a';
UPDATE band_song_refs
  SET song_id = '181aed9e-a13e-462d-b5bc-fc3ce8d4a565'
  WHERE song_id = '180660f6-fa71-47da-b4f6-e703a087b9d3';
UPDATE band_song_refs
  SET song_id = '49f26d98-e82d-4c9f-b44f-4842e33ddc4c'
  WHERE song_id = '218ecbf2-f751-46ed-aaf8-be7e127afb6e';
UPDATE band_song_refs
  SET song_id = 'e18fcbb1-f75a-4c4d-a3cb-ff2eda250698'
  WHERE song_id = '164d96cd-5c97-4514-b694-6f92ee570a4b';
UPDATE band_song_refs
  SET song_id = '35aee3a7-a8e7-4463-8268-8599c7f26776'
  WHERE song_id = '231bc4c5-2ad4-4187-b250-e9acdcc943cb';
UPDATE band_song_refs
  SET song_id = '651201c0-36b3-405f-b651-d6ccd7857f76'
  WHERE song_id = '4618831e-176d-464a-bef2-04ccc36f7eab';
UPDATE band_song_refs
  SET song_id = '61a4b296-a925-4a2a-b307-07e534c448cf'
  WHERE song_id = 'f7d99ad6-8cb8-492c-866a-45f7f4a3cbcd';
UPDATE band_song_refs
  SET song_id = '9f4c5558-a513-4f77-bc8b-65777c58f1e6'
  WHERE song_id = '0a0f0f01-aca6-4cc7-af0c-67a9e851ebe3';
UPDATE band_song_refs
  SET song_id = '1245b610-7ef0-49fa-8bff-3daf8244a16b'
  WHERE song_id = '4afcc903-dd3c-42e9-89cb-1af89a759c54';
UPDATE band_song_refs
  SET song_id = 'a0ca5d90-12f7-466a-95b0-69293bb3a239'
  WHERE song_id = '7b2484ee-4284-482a-b4d1-99c6a3931cba';
UPDATE band_song_refs
  SET song_id = '9ee19e54-d288-4632-a971-d1d7e8538a57'
  WHERE song_id = '3603d53f-395d-4622-ba31-edd6f7c5bcfd';
UPDATE band_song_refs
  SET song_id = 'a6eebf59-66a2-4203-9a9b-0ec30c5cb285'
  WHERE song_id = '699d37d0-9ab8-415f-aecc-54877adadd41';
UPDATE band_song_refs
  SET song_id = '28d2fd99-efa3-4644-8f25-679d98857b78'
  WHERE song_id = '398f8806-9d0e-4eb6-add5-c95920b04671';
UPDATE band_song_refs
  SET song_id = '01bd8791-f298-47f3-95bd-bb19b4f600f0'
  WHERE song_id = '4d69b612-052f-4f90-aa5f-e08dec61f427';
UPDATE band_song_refs
  SET song_id = '388c97d1-0982-4462-b174-b4cbbeaa8b23'
  WHERE song_id = '7b6df854-e8ac-413c-b72c-1591b20b5d7c';
UPDATE band_song_refs
  SET song_id = 'c08eb11f-6a76-4a23-bbfb-4027082a2618'
  WHERE song_id = 'a002e2db-8808-41b7-9886-e1b6a9478dee';
UPDATE band_song_refs
  SET song_id = '9bff8f43-5399-4384-a814-681b5f6228cf'
  WHERE song_id = 'bb942fdc-2219-42f3-85d8-9efc751e8ed3';
UPDATE band_song_refs
  SET song_id = '5451c71f-7341-4dcb-91c9-399738c824f1'
  WHERE song_id = 'f355eb63-5568-49d4-b0db-d534727a5bf6';
UPDATE band_song_refs
  SET song_id = '29bee9f4-84a5-42cf-97ab-1c62a530c10a'
  WHERE song_id = '882e400e-2359-4bb7-9751-04cde6553ad2';
UPDATE band_song_refs
  SET song_id = 'ae08bbb4-85b9-4ec4-a5c6-803f4df94dae'
  WHERE song_id = 'f039dd84-a1e4-4cb5-bd05-50f527386b54';

-- STEP 2: ลบเพลงซ้ำออกจาก Global Library
-- ============================================================
DELETE FROM band_songs
  WHERE id IN (
    '5891414d-a22e-436b-8dd6-e1d7a207f160',
    '35acba78-153d-43c9-b42c-c9e6c672de39',
    '93d89ea6-51ae-4d8a-a53f-69e9f3fdf141',
    'd14bab40-a197-4bc8-9175-15e115ba8fc5',
    '7bee985e-9d89-4611-9584-40fbe989ffa8',
    'd4f82441-d738-4e31-836b-cbd7168b2c9c',
    '9e3e6fb2-c644-4dc1-ba34-f22002672bf7',
    'e41064c6-6b3c-4381-8931-da7948fa05eb',
    '30eb0607-bbea-4e37-9ea6-868f2d95d443',
    'f1e5ce03-5190-4a1f-9553-8e4116dc0bbc',
    'e3ca31cf-b06a-41bb-8537-3538d9996584',
    '1c8c939e-ae0f-45e1-b276-af63d4645aa4',
    '06592cf9-7581-4138-9cbc-ca965ac0eaa5',
    '61f4d66a-a560-4288-84ac-4f21ae4f301f',
    '506c1c52-6851-4afa-9917-8968e5644a60',
    '3c3a70f4-eee3-4581-8b14-d97c489b1d2a',
    '0c8ef0c6-1704-4221-bf2a-581be79a2ce0',
    '4052440d-38a0-40b0-b9bb-00022d82edcb',
    'faaaef13-bc8c-4990-ab25-236d5c2a83ec',
    '97944129-daa0-43ab-b27f-c84af346b099'
  );

DELETE FROM band_songs
  WHERE id IN (
    '4af14a40-0862-4f68-8d59-91fd053d6188',
    '2d43ba4c-8bb0-4e7a-a1af-43777c87d2a7',
    '56f8f574-cf7a-41e4-b9f8-4448e652838a',
    'ef45c346-bdb7-4e17-899c-e30133e5b0c2',
    'd70cd0c9-b2ed-4921-ae28-7b31ec951aa0',
    '83da4252-0b65-4d75-bc54-20d691b361af',
    '1ee6491c-362b-4c10-821c-ba37d92a6495',
    'cfb53618-c506-4453-bb10-bab31dbfcb1b',
    'ca115a0a-501e-49ce-a9eb-0076321f36ed',
    'b675c406-8886-46c3-b525-2ac6175ebaec',
    'e1d662cc-409f-484a-8990-ccc1248810d4',
    '9f2aaaf9-ba76-4c7b-bf28-bddd2d26b20a',
    '9d0ecd15-49a3-4380-8ee3-7901b85ad9de',
    'fa8c1852-2991-43b5-bfef-0fa5a52b6630',
    'e7b23734-9fbe-407e-93aa-5b761eb49595',
    '7fb5f601-5449-450e-bf02-280b0a5d5e70',
    '91f8bac1-54dd-48d8-84fc-09348edff9bb',
    '1616aab3-2ec0-49c2-ace3-70f6ad4546a1',
    '507c4cd6-9b61-4dfa-8d6e-820c5774c9fa',
    '1bb69315-7b07-4544-950f-08b205fabcd7'
  );

DELETE FROM band_songs
  WHERE id IN (
    'c3fce93d-962b-4e42-b088-8163bb723179',
    '4b7b6a29-0f7e-4ad5-8320-5d5d0639915e',
    '63944936-05f6-4a17-87d9-9a400119e8a8',
    '7704dce9-d0d4-494f-a8ed-af0aacdf6c6d',
    '356576ee-57d3-4bf3-9c9c-5f4b5757d47b',
    '0f451c11-34dc-4ab8-a85f-d6d004f769e1',
    '22041f32-fcf7-485e-839c-01d89fe581f9',
    'd882b530-abd2-4070-a252-642f127bee90',
    'd5ebbfbd-f7af-4bf6-93c6-86ffb65af17a',
    '82b55a8a-07e1-4306-9dea-22d5f7fc6e3f',
    'af6146c6-b4b3-4c9f-9373-1f9c8514d613',
    'b0b707e7-6c0e-4d7e-b4b1-62b89bcf724f',
    '93e4e6f4-588c-4f92-8e74-bb946875d35c',
    'b0d8c69c-a4fc-4962-86ef-0dde63401055',
    'f0e60e0d-8048-450e-9d07-d3605fa9f0f9',
    'f65255a8-9a99-446c-9212-6e7e3cd5fe52',
    '28d423ec-3c44-4ffa-9173-e3219c352858',
    '7158f82a-f393-4309-9ba5-59b15ca6be57',
    'e783172c-eedb-4371-9b06-c0554a82b0fb',
    '79481050-95d9-408f-9376-b570a442fdc8'
  );

DELETE FROM band_songs
  WHERE id IN (
    '96887369-e5fd-44e6-a83e-0713e2af0c5f',
    '6e41d348-6713-4cf4-b18b-b1ab882c49bf',
    '2a9d982d-12b8-4c17-a118-f285b4c81a02',
    'ca02bc79-d1f6-49be-9b84-b45569af8089',
    'fb38bd3d-c062-49f5-b78c-47afacf776c6',
    '7138c9e0-c2d7-4533-be13-f23ef307909a',
    'c851da95-1633-41b6-9ca7-a47b2ab1f6e6',
    '27e53c38-edd7-4f0e-9eca-36430c25ad62',
    '073c0da3-5742-46c3-9af1-543175120e58',
    '0b261f5e-e76e-4efa-a2e5-4b72af33ac96',
    '3f1a0304-c694-4840-9cf4-e3708dd39c84',
    '0867864c-ba60-4c60-a531-93735dd13983',
    '59858076-f6f4-488a-91bf-9d7e93852dd6',
    'e5a32060-ad18-4958-a5c1-afdc3676108b',
    '8468d0c5-ace4-4c09-85ae-2e76ee044cd9',
    'db251469-9e7b-4445-b4cb-e0d9ff79c4f1',
    'a1fc9e20-0811-4b94-bdb4-f0223f4a1940',
    'fd531cdd-1bd7-4311-a5b0-083cd3e214a1',
    '2477f4fe-063f-400a-a8c6-6046da917441',
    'd16bfac2-1e73-4cc6-94f9-01c71708e143'
  );

DELETE FROM band_songs
  WHERE id IN (
    '6f48f001-a6c4-43e8-a718-301a5f8c296e',
    '3d0c3520-bd56-433e-b45d-c0613a0310fa',
    '52fd8b40-4107-4ba8-bfff-d1f6fbdeee61',
    '959619ef-f4ca-41c9-85b4-98a280ac5462',
    '844f6089-58dc-403f-b9a9-7b20e7015622',
    '2e00eb55-9e73-42de-b4f3-8f412fe53d2c',
    'a46ad867-6c4f-4754-85ec-6e81c3073280',
    '61322633-2a8f-4c71-b9af-8efee10ec65a',
    '180660f6-fa71-47da-b4f6-e703a087b9d3',
    '218ecbf2-f751-46ed-aaf8-be7e127afb6e',
    '164d96cd-5c97-4514-b694-6f92ee570a4b',
    '231bc4c5-2ad4-4187-b250-e9acdcc943cb',
    '4618831e-176d-464a-bef2-04ccc36f7eab',
    'f7d99ad6-8cb8-492c-866a-45f7f4a3cbcd',
    '0a0f0f01-aca6-4cc7-af0c-67a9e851ebe3',
    '4afcc903-dd3c-42e9-89cb-1af89a759c54',
    '7b2484ee-4284-482a-b4d1-99c6a3931cba',
    '3603d53f-395d-4622-ba31-edd6f7c5bcfd',
    '699d37d0-9ab8-415f-aecc-54877adadd41',
    '398f8806-9d0e-4eb6-add5-c95920b04671'
  );

DELETE FROM band_songs
  WHERE id IN (
    '4d69b612-052f-4f90-aa5f-e08dec61f427',
    '7b6df854-e8ac-413c-b72c-1591b20b5d7c',
    'a002e2db-8808-41b7-9886-e1b6a9478dee',
    'bb942fdc-2219-42f3-85d8-9efc751e8ed3',
    'f355eb63-5568-49d4-b0db-d534727a5bf6',
    '882e400e-2359-4bb7-9751-04cde6553ad2',
    'f039dd84-a1e4-4cb5-bd05-50f527386b54'
  );

-- ============================================================
-- DONE: ลบสำเร็จ
-- ============================================================
