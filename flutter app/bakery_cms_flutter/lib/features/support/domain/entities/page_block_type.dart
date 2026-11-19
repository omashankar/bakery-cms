/// How a CMS page block is drawn: the website's `renderBlocks` draws a
/// `heading` as a heading and every other block as a paragraph.
enum PageBlockType {
  heading,
  paragraph;

  static PageBlockType fromApi(String value) => value == 'heading' ? heading : paragraph;
}
